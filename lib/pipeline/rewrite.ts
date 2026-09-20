import { supabase } from "@/lib/supabase/server";
import { rewriteArticle } from "@/lib/rewrite/rewrite";
import { saveDraft, getDraftByArticleId } from "@/lib/db/drafts";
import { checkDraft } from "@/lib/review/checks";
import { noDeadline, type Deadline } from "./deadline";

export interface RewriteItemResult {
  id: string;
  title: string;
  status: "draft" | "skipped" | "error";
  draftId?: string;
  reason?: string;
  error?: string;
}

/**
 * Cost control. Each draft costs three AI calls — the rewrite plus the fact
 * and quality checks — and every one carries source text, making this by far
 * the heaviest stage. Groq's free tier allows 100,000 tokens per DAY, which
 * an uncapped run can exhaust on its own. Whatever is not drafted stays in
 * `extracted` and is picked up by the next run.
 */
const MAX_DRAFTS_PER_RUN = Number(process.env.MAX_DRAFTS_PER_RUN ?? 3);

/** Rough cost of one draft: rewrite + fact check + quality check, with backoff. */
const DRAFT_RESERVE_MS = 30_000;

/**
 * Was this a rate limit rather than a real failure?
 *
 * On the free tier a deferral is normal traffic shaping: the article stays
 * queued and the next run picks it up. Counting it as an error would mark
 * every run "partial" and make the dashboard's status worthless — the panel
 * should flag runs that need attention, not runs that behaved correctly.
 */
function isRateLimitDeferral(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return /rate limit|429|asked for a .* wait|request too large|tokens per/i.test(
    message
  );
}

export interface RewriteResult {
  rewritten: number;
  deferred: number;
  skipped: number;
  errors: number;
  results: RewriteItemResult[];
}

export async function runRewrite(
  deadline: Deadline = noDeadline()
): Promise<RewriteResult> {
  console.log("[pipeline] Starting rewrite");

  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, title, content")
    .eq("status", "extracted")
    // Oldest first. Without an explicit order Postgres returns rows in a
    // stable arbitrary order, so a single article that always fails is
    // selected on every run and blocks everything behind it forever — which
    // is exactly what happened with one 413-ing article and a cap of 1.
    .order("discovered_at", { ascending: true })
    .limit(MAX_DRAFTS_PER_RUN);

  if (error) {
    throw new Error(`Failed to fetch extracted articles: ${error.message}`);
  }

  if (!articles || articles.length === 0) {
    console.log("[pipeline] Rewrite complete: 0 generated, 0 skipped");
    return {
      rewritten: 0,
      skipped: 0,
      errors: 0,
      deferred: 0,
      results: [],
    };
  }

  const results: RewriteItemResult[] = [];

  for (const article of articles) {
    if (deadline.expired(DRAFT_RESERVE_MS)) {
      console.log(
        "[pipeline] Rewrite stopping early — run budget nearly spent"
      );
      break;
    }

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

      // Automated review. Never throws, so a check failure cannot cost us
      // the draft we just paid to generate.
      const checks = await checkDraft(draft, article.content, deadline);

      const saved = await saveDraft(article.id, draft, checks);

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
      const message = err instanceof Error ? err.message : "Unknown error";

      results.push({
        id: article.id,
        title: article.title,
        status: isRateLimitDeferral(err) ? "skipped" : "error",
        reason: isRateLimitDeferral(err)
          ? "Deferred by a provider rate limit; still queued."
          : undefined,
        error: message,
      });
    }
  }

  const rewrittenCount = results.filter((r) => r.status === "draft").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  // Anything still sitting in `extracted` after this run.
  const { count: remaining } = await supabase
    .from("articles")
    .select("*", { count: "exact", head: true })
    .eq("status", "extracted");

  const result: RewriteResult = {
    rewritten: rewrittenCount,
    skipped: skippedCount,
    errors: errorCount,
    deferred: remaining ?? 0,
    results,
  };

  console.log(
    `[pipeline] Rewrite complete: ${result.rewritten} generated, ${result.skipped} skipped`
  );

  return result;
}
