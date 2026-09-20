import { runDiscovery, DiscoveryResult } from "./discover";
import { runScoring, ScoringResult } from "./score";
import { runExtraction, ExtractionResult } from "./extract";
import { runRewrite, RewriteResult } from "./rewrite";
import {
  startRun,
  finishRun,
  type PipelineTrigger,
} from "@/lib/db/pipeline-runs";
import { createDeadline } from "./deadline";

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
  /** Failures inside stages that themselves completed. */
  itemErrors: number;
  /** Stages not started because the run budget was nearly spent. */
  skippedForTime: StageName[];
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

/**
 * Per-item errors inside a stage that otherwise completed.
 *
 * A stage only lands in `failedStages` when it throws. Scoring catches each
 * article's error and carries on, so a run where all 15 articles failed still
 * reported success — which is exactly the run you most want flagged.
 */
function errorsOf<T>(outcome: StageOutcome<T>): number {
  if (outcome.status !== "ok") return 0;

  const value = (outcome.result as { errors?: unknown }).errors;

  return typeof value === "number" ? value : 0;
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

/**
 * How long a run may take before it stops starting new work.
 *
 * The serverless function is killed at `maxDuration` with no chance to clean
 * up — the pipeline_runs row would stay 'running' and hold the lock until the
 * 15-minute stale reclaim. So stages stop voluntarily with headroom to spare
 * and leave the rest queued; the next run picks it up.
 *
 * A cron run with a 105s budget was killed mid-flight and left its row stuck
 * in 'running' — proof that the platform ceiling is well below the 120s the
 * route asks for, and that a route-segment maxDuration above the plan limit
 * is clamped silently. 45s fits comfortably inside a 60s ceiling.
 *
 * Raise it via PIPELINE_BUDGET_MS only after a run's RECORDED duration proves
 * a larger limit is honoured. A run that finishes is worth more than a run
 * that attempts more and dies.
 */
const RUN_BUDGET_MS = Number(process.env.PIPELINE_BUDGET_MS ?? 45_000);

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

  // One budget, shared by the runner and every stage. Stages also check it
  // between items, because how long a stage takes depends on rate-limit
  // backoff rather than on how many items it was given.
  const deadline = createDeadline(RUN_BUDGET_MS);

  const skippedForTime: StageName[] = [];

  /** Runs a stage only if there is budget left for it. */
  const stageIfTime = async <T>(
    name: StageName,
    stage: () => Promise<T>,
    reserveMs: number
  ): Promise<StageOutcome<T>> => {
    if (deadline.expired(reserveMs)) {
      console.warn(
        `[pipeline] Skipping "${name}" — not enough time left in the run budget`
      );

      skippedForTime.push(name);

      return {
        status: "failed",
        error: "Skipped: insufficient time left in the run budget.",
      };
    }

    return runStage(name, stage);
  };

  // Stages run MOST-ADVANCED FIRST, deliberately.
  //
  // The obvious order — discover, score, extract, rewrite — starves the only
  // stage that produces something you can publish: rewrite runs last, and on
  // a tight budget there is never time left for it. Three cron runs produced
  // zero drafts that way while the backlog kept growing.
  //
  // Draining first is also self-balancing. When there is a backlog, rewrite
  // uses the budget and discovery is skipped, which is correct — adding more
  // raw articles to a queue you cannot drain is pure cost. When the backlog
  // is empty, each drain stage returns immediately with nothing to do and the
  // budget falls through to discovery, refilling the funnel.
  //
  // Reserves are rough lower bounds for "can this stage do anything useful".
  const rewrite = await stageIfTime(
    "rewrite",
    () => runRewrite(deadline),
    30_000
  );
  const extraction = await stageIfTime(
    "extraction",
    () => runExtraction(deadline),
    8_000
  );
  const scoring = await stageIfTime("scoring", () => runScoring(deadline), 12_000);
  const discovery = await stageIfTime("discovery", runDiscovery, 20_000);

  const finishedAt = new Date();

  const failedStages = (
    [
      ["discovery", discovery],
      ["scoring", scoring],
      ["extraction", extraction],
      ["rewrite", rewrite],
    ] as const
  )
    .filter(
      ([name, outcome]) =>
        outcome.status === "failed" &&
        !skippedForTime.includes(name as StageName)
    )
    .map(([name]) => name as StageName);

  const durationMs = finishedAt.getTime() - startedAt.getTime();

  const itemErrors =
    errorsOf(discovery) +
    errorsOf(scoring) +
    errorsOf(extraction) +
    errorsOf(rewrite);

  // Clean means: no stage threw AND nothing inside a stage failed.
  const success = failedStages.length === 0 && itemErrors === 0;

  console.log(
    success
      ? `[pipeline] Pipeline complete in ${durationMs}ms`
      : `[pipeline] Pipeline finished in ${durationMs}ms — failed stages: ${
          failedStages.length > 0 ? failedStages.join(", ") : "none"
        }; item errors: ${itemErrors}`
  );

  // Always release the lock, even if recording the outcome fails — otherwise
  // the row sits in 'running' until reclaimStaleRuns clears it.
  await finishRun(runId, {
    status: success ? "succeeded" : "partial",
    durationMs,
    failedStages,
    error:
      itemErrors > 0 && failedStages.length === 0
        ? `${itemErrors} item(s) failed inside otherwise-completed stages.`
        : failedStages.length > 0
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
    itemErrors,
    skippedForTime,
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
