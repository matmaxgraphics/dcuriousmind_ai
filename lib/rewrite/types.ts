import type { ExtractedArticle } from "../extractor/types";

export interface RewrittenArticle {
  title: string;
  content: string;
  summary: string;
  originalUrl: string;
  source: string;
}
