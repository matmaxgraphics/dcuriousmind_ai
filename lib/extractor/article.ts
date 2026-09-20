import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

import type { ExtractedArticle } from "./types";
import { validateExtractedArticle } from "./validate";

/**
 * Article extraction.
 *
 * Uses linkedom rather than jsdom to build the DOM that Readability needs.
 * jsdom could not be loaded in a deployed serverless function at all: its
 * dependency chain reaches @exodus/bytes, which is pure ESM, and Next's
 * external-module loader require()s it, throwing ERR_REQUIRE_ESM before any
 * application code runs. Pinning Node and toggling serverExternalPackages
 * both failed; the dependency itself had to go.
 *
 * linkedom is dramatically lighter (jsdom pulled 778 files into the function
 * trace) and gives Readability everything it needs.
 */

const USER_AGENT = "Mozilla/5.0 (compatible; CuriousMind/1.0)";

export async function extractArticle(
  url: string
): Promise<ExtractedArticle> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.status}`);
  }

  const html = await response.text();

  const { document } = parseHTML(html);

  // Readability resolves relative links against the document's URI. linkedom
  // does not set one from a bare string, so supply it explicitly — otherwise
  // every relative href in the extracted content is broken.
  try {
    Object.defineProperty(document, "baseURI", {
      value: url,
      configurable: true,
    });
    Object.defineProperty(document, "documentURI", {
      value: url,
      configurable: true,
    });
  } catch {
    // Non-fatal: only affects relative link resolution.
  }

  // linkedom's Document is structurally compatible with what Readability
  // uses, but not with jsdom's exact TypeScript type.
  const reader = new Readability(document as unknown as Document);
  const article = reader.parse();

  if (!article) {
    throw new Error(`Could not extract article content from ${url}`);
  }

  const extracted: ExtractedArticle = {
    title: article.title || "",
    url,
    source: new URL(url).hostname,
    content: article.textContent || "",
    excerpt: article.excerpt ?? undefined,
    author: article.byline ?? undefined,
  };

  if (!validateExtractedArticle(extracted)) {
    throw new Error(`Invalid article content extracted from ${url}`);
  }

  return extracted;
}
