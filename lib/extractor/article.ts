import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import type { ExtractedArticle } from "./types";
import { validateExtractedArticle } from "./validate";

export async function extractArticle(
  url: string
): Promise<ExtractedArticle> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; CuriousMind/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch article: ${response.status}`
    );
  }

  const html = await response.text();

  const dom = new JSDOM(html, {
    url,
  });

  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    throw new Error(
      `Could not extract article content from ${url}`
    );
  }

  const extracted: ExtractedArticle = {
    title: article.title,
    url,
    source: new URL(url).hostname,
    content: article.textContent,
    excerpt: article.excerpt ?? undefined,
    author: article.byline ?? undefined,
  };

  if (!validateExtractedArticle(extracted)) {
    throw new Error(
      `Invalid article content extracted from ${url}`
    );
  }

  return extracted;
}