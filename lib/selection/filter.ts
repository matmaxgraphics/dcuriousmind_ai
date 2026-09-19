import type {
  ContentSource,
  DiscoveredArticle,
} from "@/lib/discovery/types";

/**
 * Deterministic, free filtering applied before anything reaches the AI.
 *
 * Every article dropped here is one we do not pay to score, so this is the
 * cheapest cost control in the pipeline.
 */
export function filterArticles(
  articles: DiscoveredArticle[],
  source: ContentSource
): DiscoveredArticle[] {
  const seen = new Set<string>();

  return articles.filter((article) => {
    let url: URL;

    try {
      url = new URL(article.url);
    } catch {
      return false;
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    if (!article.title?.trim()) {
      return false;
    }

    // Per-source rule: is this actually an article on that site?
    if (!source.accepts(url)) {
      return false;
    }

    // A feed can list the same link twice; the database unique constraint
    // would catch it, but deduping here keeps the reported counts honest.
    const key = url.toString();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}
