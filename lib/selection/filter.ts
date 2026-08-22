import type { DiscoveredArticle } from "@/lib/discovery/types";

export function filterArticles(
  articles: DiscoveredArticle[]
): DiscoveredArticle[] {
  return articles.filter((article) => {
    try {
      const url = new URL(article.url);

      if (url.hostname !== "wikenigma.org.uk") {
        return false;
      }

      if (!url.pathname.startsWith("/content/")) {
        return false;
      }

      if (url.searchParams.has("idx")) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  });
}