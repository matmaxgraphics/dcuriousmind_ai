import { supabase } from "@/lib/supabase/server";
import type { DiscoveredArticle } from "@/lib/discovery/types";

export async function saveDiscoveredArticles(
  articles: DiscoveredArticle[],
  sourceId: string
) {
  if (articles.length === 0) {
    return [];
  }

  const rows = articles.map((article) => ({
    source_id: sourceId,
    title: article.title,
    url: article.url,
    excerpt: article.excerpt ?? null,
    published_at: article.publishedAt
      ? new Date(article.publishedAt).toISOString()
      : null,
    updated_at: article.updatedAt
      ? new Date(article.updatedAt).toISOString()
      : null,
    discovered_at: article.discoveredAt,
    status: "discovered" as const,
  }));

  const { data, error } = await supabase
    .from("articles")
    .upsert(rows, {
      onConflict: "source_id,url",
      ignoreDuplicates: true,
    })
    .select();

  if (error) {
    throw new Error(
      `Failed to save discovered articles: ${error.message}`
    );
  }

  return data;
}

export async function saveExtractedContent(
  articleId: string,
  content: string
) {
  const { data, error } = await supabase
    .from("articles")
    .update({
      content,
      status: "extracted",
    })
    .eq("id", articleId)
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to save extracted article: ${error.message}`
    );
  }

  return data;
}