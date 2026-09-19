export interface DiscoveredArticle {
  title: string;
  url: string;
  source: string;
  category?: string;
  excerpt?: string;
  publishedAt?: string;
  updatedAt?: string;
  discoveredAt: string;
}

export interface ContentSource {
  /**
   * Must match the `name` column of the corresponding row in the `sources`
   * table — that is how discovered articles get attributed to the right
   * source.
   */
  name: string;
  baseUrl: string;
  feedUrl: string;

  /**
   * Per-source URL rule, applied after discovery. Returning false drops the
   * article before it costs anything to score.
   */
  accepts(url: URL): boolean;

  discover(): Promise<DiscoveredArticle[]>;
}
