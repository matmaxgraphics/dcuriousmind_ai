import * as cheerio from "cheerio";
import type {
  ContentSource,
  DiscoveredArticle,
} from "./types";

const WIKENIGMA_URL = "https://wikenigma.org.uk/";

export function isArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    if (parsed.hostname !== "wikenigma.org.uk") {
      return false;
    }

    if (!parsed.pathname.startsWith("/content/")) {
      return false;
    }

    if (parsed.searchParams.has("idx")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export const wikenigmaSource: ContentSource = {
  name: "Wikenigma",
  baseUrl: WIKENIGMA_URL,

  async discover(): Promise<DiscoveredArticle[]> {
    const response = await fetch(WIKENIGMA_URL);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Wikenigma: ${response.status}`
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const articles: DiscoveredArticle[] = [];

    $("a").each((_, element) => {
      const href = $(element).attr("href");
      const title = $(element).text().trim();

      if (!href || !title) return;

      const url = new URL(href, WIKENIGMA_URL).toString();

      if (!isArticleUrl(url)) return;

      articles.push({
        title,
        url,
        source: "Wikenigma",
        discoveredAt: new Date().toISOString(),
      });
    });

    return articles;
  },
};