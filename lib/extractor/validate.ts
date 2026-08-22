import type { ExtractedArticle } from "./types";

const INVALID_CONTENT_PATTERNS = [
  "This topic does not exist yet",
  "You have followed a link to a topic that doesn't exist yet",
];

export function validateExtractedArticle(
  article: ExtractedArticle
): boolean {
  if (!article.title.trim()) {
    return false;
  }

  if (!article.content.trim()) {
    return false;
  }

  const content = article.content.toLowerCase();

  return !INVALID_CONTENT_PATTERNS.some((pattern) =>
    content.includes(pattern.toLowerCase())
  );
}