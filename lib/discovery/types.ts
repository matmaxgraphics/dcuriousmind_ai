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
  name: string;
  baseUrl: string;
  discover(): Promise<DiscoveredArticle[]>;
}