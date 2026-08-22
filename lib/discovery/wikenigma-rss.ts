import Parser from "rss-parser";
import type {
  ContentSource,
  DiscoveredArticle,
} from "./types";

const parser = new Parser();

const FEED_URL = "https://wikenigma.org.uk/feed.php";

export const wikenigmaRssSource: ContentSource = {
  name: "Wikenigma RSS",
  baseUrl: "https://wikenigma.org.uk",

  async discover(): Promise<DiscoveredArticle[]> {
    const feed = await parser.parseURL(FEED_URL);

    return feed.items
      .filter((item) => item.link && item.title)
      .map((item) => ({
        title: item.title!.trim(),
        url: item.link!,
        source: "Wikenigma",
        excerpt: item.contentSnippet?.trim(),
        publishedAt: item.pubDate,
        discoveredAt: new Date().toISOString(),
      }));
  },
};