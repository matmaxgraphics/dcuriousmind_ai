import { supabase } from "@/lib/supabase/server";

export type PipelineTrigger = "cron" | "manual" | "api";

/**
 * A run that crashed hard — process killed, function timed out — leaves its row
 * stuck in 'running' and would block every future run. Anything older than this
 * is assumed dead and reclaimed.
 *
 * Kept comfortably above the route's maxDuration (300s) so a slow-but-alive run
 * is never reclaimed out from under itself.
 */
const STALE_RUN_MINUTES = 15;

/** Postgres unique-violation. Here it means: another run holds the lock. */
const UNIQUE_VIOLATION = "23505";

export interface StartRunResult {
  id: string | null;
  /** True when another run is already in flight and this one should not start. */
  locked: boolean;
}

/**
 * Marks abandoned runs as failed so a crashed run cannot block the pipeline
 * forever. Returns how many were reclaimed.
 */
export async function reclaimStaleRuns(): Promise<number> {
  const cutoff = new Date(
    Date.now() - STALE_RUN_MINUTES * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("pipeline_runs")
    .update({
      status: "failed",
      error: `Run exceeded ${STALE_RUN_MINUTES} minutes and was reclaimed as stale.`,
      finished_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("started_at", cutoff)
    .select("id");

  if (error) {
    // Never block a run because cleanup failed.
    console.error("[pipeline] Failed to reclaim stale runs:", error.message);
    return 0;
  }

  if (data && data.length > 0) {
    console.warn(`[pipeline] Reclaimed ${data.length} stale run(s)`);
  }

  return data?.length ?? 0;
}

/**
 * Claims the run lock. The unique partial index on `status = 'running'` means
 * exactly one caller can hold it; everyone else gets `locked: true`.
 */
export async function startRun(
  trigger: PipelineTrigger
): Promise<StartRunResult> {
  await reclaimStaleRuns();

  const { data, error } = await supabase
    .from("pipeline_runs")
    .insert({ status: "running", trigger })
    .select("id")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      console.warn(
        "[pipeline] Another run is already in progress — skipping this one."
      );

      return { id: null, locked: true };
    }

    // The table may not exist yet, or the database may be unreachable. Log it
    // and let the pipeline run unrecorded rather than blocking the product on
    // its own bookkeeping.
    console.error("[pipeline] Failed to record run start:", error.message);

    return { id: null, locked: false };
  }

  return { id: data.id, locked: false };
}

export interface FinishRunInput {
  status: "succeeded" | "partial" | "failed";
  durationMs: number;
  failedStages: string[];
  error?: string;
  counts: {
    articlesDiscovered: number;
    articlesSaved: number;
    topicsScored: number;
    topicsSelected: number;
    articlesExtracted: number;
    draftsGenerated: number;
  };
  stages: unknown;
}

/** Releases the lock and records the outcome. */
export async function finishRun(
  runId: string | null,
  input: FinishRunInput
): Promise<void> {
  if (!runId) {
    return;
  }

  const { error } = await supabase
    .from("pipeline_runs")
    .update({
      status: input.status,
      finished_at: new Date().toISOString(),
      duration_ms: input.durationMs,
      failed_stages: input.failedStages,
      error: input.error ?? null,
      articles_discovered: input.counts.articlesDiscovered,
      articles_saved: input.counts.articlesSaved,
      topics_scored: input.counts.topicsScored,
      topics_selected: input.counts.topicsSelected,
      articles_extracted: input.counts.articlesExtracted,
      drafts_generated: input.counts.draftsGenerated,
      stages: input.stages,
    })
    .eq("id", runId);

  if (error) {
    // Critical: if this fails the row stays 'running' and holds the lock until
    // reclaimStaleRuns picks it up.
    console.error("[pipeline] Failed to record run completion:", error.message);
  }
}

export async function getRecentRuns(limit = 10) {
  const { data, error } = await supabase
    .from("pipeline_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch pipeline runs: ${error.message}`);
  }

  return data;
}
