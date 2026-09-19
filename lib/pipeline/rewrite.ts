import { supabase } from "@/lib/supabase/server";
import { rewriteArticle } from "@/lib/rewrite/rewrite";
import { saveDraft, getDraftByArticleId } from "@/lib/db/drafts";

export interface RewriteItemResult {
  id: string;
  title: string;
  status: "draft" | "skipped" | "error";
  draftId?: string;
  reason?: string;
  error?: string;
}

export interface RewriteResult {
  rewritten: number;
  skipped: number;
  errors: number;
  results: RewriteItemResult[];
}

export async function runRewrite(): Promise<RewriteResult> {
  console.log("[pipeline] Starting rewrite");

  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, title, content")
    .eq("status", "extracted");

  if (error) {
    throw new Error(`Failed to fetch extracted articles: ${error.message}`);
  }

  if (!articles || articles.length === 0) {
    console.log("[pipeline] Rewrite complete: 0 generated, 0 skipped");
    return {
      rewritten: 0,
      skipped: 0,
      errors: 0,
      results: [],
    };
  }

  const results: RewriteItemResult[] = [];

  for (const article of articles) {
    try {
      if (!article.content?.trim()) {
        results.push({
          id: article.id,
          title: article.title,
          status: "error",
          error: "Article has no extracted content.",
        });

        continue;
      }

      // Idempotency check: verify if a draft already exists for this article
      const existingDraft = await getDraftByArticleId(article.id);
      if (existingDraft) {
        // Ensure article status is updated to processed if not already
        await supabase
          .from("articles")
          .update({
            status: "processed",
          })
          .eq("id", article.id);

        results.push({
          id: article.id,
          title: article.title,
          status: "skipped",
          draftId: existingDraft.id,
          reason: "Draft already exists for this article.",
        });

        continue;
      }

      const draft = await rewriteArticle({
        title: article.title,
        content: article.content,
      });

      const saved = await saveDraft(article.id, draft);

      await supabase
        .from("articles")
        .update({
          status: "processed",
        })
        .eq("id", article.id);

      results.push({
        id: article.id,
        title: article.title,
        status: "draft",
        draftId: saved.id,
      });
    } catch (err) {
      results.push({
        id: article.id,
        title: article.title,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const rewrittenCount = results.filter((r) => r.status === "draft").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  const result: RewriteResult = {
    rewritten: rewrittenCount,
    skipped: skippedCount,
    errors: errorCount,
    results,
  };

  console.log(
    `[pipeline] Rewrite complete: ${result.rewritten} generated, ${result.skipped} skipped`
  );

  return result;
}
