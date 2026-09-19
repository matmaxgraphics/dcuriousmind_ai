import { supabase } from "@/lib/supabase/server";
import { generateThread } from "@/lib/thread/generate";
import { validateThread } from "@/lib/thread/validate";
import { saveThread, getThreadByDraftId } from "@/lib/db/threads";

export interface ThreadItemResult {
  draftId: string;
  threadId?: string;
  title?: string;
  tweets?: number;
  status: "generated" | "skipped" | "error";
  reason?: string;
  error?: string;
}

export interface ThreadGenerationResult {
  generated: number;
  skipped: number;
  errors: number;
  results: ThreadItemResult[];
}

export async function runThreadGeneration(): Promise<ThreadGenerationResult> {
  console.log("[pipeline] Starting thread generation");

  const { data: drafts, error } = await supabase
    .from("drafts")
    .select(`
      id,
      article_id,
      question,
      explanation,
      interesting_detail,
      takeaway,
      articles (
        title,
        url
      )
    `)
    // Only approved drafts become threads. This is the human-in-the-loop gate:
    // a draft that has not been reviewed must never reach thread generation,
    // let alone publishing.
    .eq("status", "approved");

  if (error) {
    throw new Error(`Failed to fetch drafts: ${error.message}`);
  }

  if (!drafts || drafts.length === 0) {
    console.log("[pipeline] Thread generation complete: 0 generated, 0 skipped");
    return {
      generated: 0,
      skipped: 0,
      errors: 0,
      results: [],
    };
  }

  const results: ThreadItemResult[] = [];

  for (const draft of drafts) {
    try {
      const article = Array.isArray(draft.articles)
        ? draft.articles[0]
        : draft.articles;

      if (!article) {
        throw new Error("Associated article could not be found.");
      }

      // Idempotency check: verify if a thread already exists for this draft
      const existingThread = await getThreadByDraftId(draft.id);
      if (existingThread) {
        results.push({
          draftId: draft.id,
          threadId: existingThread.id,
          title: existingThread.title,
          status: "skipped",
          reason: "Thread already exists for this draft.",
        });

        continue;
      }

      const thread = await generateThread({
        title: article.title,
        question: draft.question,
        explanation: draft.explanation,
        interestingDetail: draft.interesting_detail ?? "",
        takeaway: draft.takeaway ?? "",
        sourceUrl: article.url,
      });

      const validationErrors = validateThread(thread);

      if (validationErrors.length > 0) {
        throw new Error(
          `Thread validation failed: ${validationErrors.join(" ")}`
        );
      }

      const saved = await saveThread(draft.id, thread);

      results.push({
        draftId: draft.id,
        threadId: saved.thread.id,
        title: thread.title,
        tweets: saved.tweets.length,
        status: "generated",
      });
    } catch (err) {
      results.push({
        draftId: draft.id,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  const generatedCount = results.filter((r) => r.status === "generated").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  const result: ThreadGenerationResult = {
    generated: generatedCount,
    skipped: skippedCount,
    errors: errorCount,
    results,
  };

  console.log(
    `[pipeline] Thread generation complete: ${result.generated} generated, ${result.skipped} skipped`
  );

  return result;
}
