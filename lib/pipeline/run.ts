import { runDiscovery, DiscoveryResult } from "./discover";
import { runScoring, ScoringResult } from "./score";
import { runExtraction, ExtractionResult } from "./extract";
import { runRewrite, RewriteResult } from "./rewrite";
import {
  startRun,
  finishRun,
  type PipelineTrigger,
} from "@/lib/db/pipeline-runs";

export type StageName =
  | "discovery"
  | "scoring"
  | "extraction"
  | "rewrite";

export type StageOutcome<T> =
  | { status: "ok"; result: T }
  | { status: "failed"; error: string };

export interface PipelineRunResult {
  /** True only when every stage completed. */
  success: boolean;
  /** Set when another run held the lock and this one did not execute. */
  skipped?: true;
  runId: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  failedStages: StageName[];
  discovery: StageOutcome<DiscoveryResult>;
  scoring: StageOutcome<ScoringResult>;
  extraction: StageOutcome<ExtractionResult>;
  rewrite: StageOutcome<RewriteResult>;
}

/** Shape returned when the lock is already held. */
export interface PipelineSkippedResult {
  success: false;
  skipped: true;
  runId: null;
  reason: string;
}

function countOf<T, K extends keyof T>(
  outcome: StageOutcome<T>,
  key: K
): number {
  if (outcome.status !== "ok") {
    return 0;
  }

  const value = outcome.result[key];

  return typeof value === "number" ? value : 0;
}

async function runStage<T>(
  name: StageName,
  stage: () => Promise<T>
): Promise<StageOutcome<T>> {
  try {
    return { status: "ok", result: await stage() };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    console.error(`[pipeline] Stage "${name}" failed:`, error);

    return { status: "failed", error: message };
  }
}

/**
 * Runs the four automated stages in order.
 *
 * Stages are isolated: a failure in one is recorded and the rest still run.
 * They communicate through article status in the database rather than through
 * return values, so a failed discovery does not invalidate the scoring of
 * articles discovered on an earlier run — those are still sitting in the
 * `discovered` state waiting to be picked up.
 */
export async function runPipeline(
  trigger: PipelineTrigger = "manual"
): Promise<PipelineRunResult | PipelineSkippedResult> {
  console.log("[pipeline] Starting full automated pipeline execution");

  // Claim the lock before spending anything. Two overlapping runs would both
  // pick up the same `discovered` articles and pay to score them twice.
  const { id: runId, locked } = await startRun(trigger);

  if (locked) {
    return {
      success: false,
      skipped: true,
      runId: null,
      reason: "Another pipeline run is already in progress.",
    };
  }

  const startedAt = new Date();

  const discovery = await runStage("discovery", runDiscovery);
  const scoring = await runStage("scoring", runScoring);
  const extraction = await runStage("extraction", runExtraction);
  const rewrite = await runStage("rewrite", runRewrite);

  const finishedAt = new Date();

  const failedStages = (
    [
      ["discovery", discovery],
      ["scoring", scoring],
      ["extraction", extraction],
      ["rewrite", rewrite],
    ] as const
  )
    .filter(([, outcome]) => outcome.status === "failed")
    .map(([name]) => name as StageName);

  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const success = failedStages.length === 0;

  console.log(
    success
      ? `[pipeline] Pipeline complete in ${durationMs}ms`
      : `[pipeline] Pipeline finished in ${durationMs}ms with failed stages: ${failedStages.join(", ")}`
  );

  // Always release the lock, even if recording the outcome fails — otherwise
  // the row sits in 'running' until reclaimStaleRuns clears it.
  await finishRun(runId, {
    status: success ? "succeeded" : "partial",
    durationMs,
    failedStages,
    error:
      failedStages.length > 0
        ? failedStages
            .map((name) => {
              const outcome = { discovery, scoring, extraction, rewrite }[name];
              return `${name}: ${
                outcome.status === "failed" ? outcome.error : "unknown"
              }`;
            })
            .join(" | ")
        : undefined,
    counts: {
      articlesDiscovered: countOf(discovery, "discovered"),
      articlesSaved: countOf(discovery, "saved"),
      topicsScored: countOf(scoring, "scored"),
      topicsSelected: countOf(scoring, "selected"),
      articlesExtracted: countOf(extraction, "extracted"),
      draftsGenerated: countOf(rewrite, "rewritten"),
    },
    stages: { discovery, scoring, extraction, rewrite },
  });

  return {
    success,
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    failedStages,
    discovery,
    scoring,
    extraction,
    rewrite,
  };
}
