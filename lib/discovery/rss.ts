import Parser from "rss-parser";
import type { ContentSource, DiscoveredArticle } from "./types";

const parser = new Parser();

/**
 * Identifying ourselves honestly as a bot. This is not cosmetic: ScienceAlert
 * serves 403 to browser-shaped user agents and 200 to a `compatible;` bot
 * string, so fetching the feed ourselves — rather than letting rss-parser do
 * it — is what makes that source work at all.
 */
const FEED_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; CuriousMind/1.0)",
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
};

const MAX_ATTEMPTS = 3;
const FEED_TIMEOUT_MS = 20000;

/**
 * Fetches a feed, retrying transient failures with backoff.
 *
 * A 4xx is the server telling us the request itself is wrong, so it is not
 * retried — only network errors and 5xx are.
 */
async function fetchFeed(url: string): Promise<string> {
  let lastError: Error = new Error(`Failed to fetch ${url}`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers: FEED_HEADERS,
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      });

      if (response.ok) {
        return await response.text();
      }

      const error = new Error(
        `Feed request failed with status ${response.status}`
      );

      if (response.status < 500) {
        throw error;
      }

      lastError = error;
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Unknown feed fetch error");

      // Don't burn retries on a definitive rejection.
      if (error.message.includes("status 4")) {
        throw error;
      }

      lastError = error;
    }

    if (attempt < MAX_ATTEMPTS) {
      const backoffMs = 500 * 2 ** (attempt - 1);

      console.warn(
        `[discovery] ${url} attempt ${attempt} failed (${lastError.message}), retrying in ${backoffMs}ms`
      );

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}

/** Compares hostnames ignoring a leading `www.`. */
export function hostMatches(url: URL, expected: string): boolean {
  const strip = (host: string) => host.replace(/^www\./, "").toLowerCase();

  return strip(url.hostname) === strip(expected);
}

export interface RssSourceConfig {
  name: string;
  baseUrl: string;
  feedUrl: string;
  category?: string;
  accepts(url: URL): boolean;
}

/**
 * Builds a ContentSource from an RSS or Atom feed. rss-parser handles both;
 * Wikenigma publishes Atom, the rest publish RSS 2.0.
 */
export function createRssSource(config: RssSourceConfig): ContentSource {
  return {
    name: config.name,
    baseUrl: config.baseUrl,
    feedUrl: config.feedUrl,
    accepts: config.accepts,

    async discover(): Promise<DiscoveredArticle[]> {
      const xml = await fetchFeed(config.feedUrl);
      const feed = await parser.parseString(xml);

      return feed.items
        .filter((item) => item.link && item.title)
        .map((item) => ({
          title: item.title!.trim(),
          url: item.link!.trim(),
          source: config.name,
          category: config.category,
          excerpt: item.contentSnippet?.trim(),
          publishedAt: item.pubDate ?? item.isoDate,
          discoveredAt: new Date().toISOString(),
        }));
    },
  };
}
