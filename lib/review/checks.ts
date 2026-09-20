import { generateJson } from "@/lib/ai/json";
import { loadPrompt, loadRule, composePrompt } from "@/lib/prompts/load";
import type { RewriteResult } from "@/lib/rewrite/rewrite";

/**
 * Automated review of a freshly generated draft.
 *
 * These do not gate anything on their own — a draft always reaches the human
 * reviewer. Their job is to tell that reviewer where to look, which matters
 * most for generated questions: the topic was proposed by AI and grounded in
 * a source afterwards, so the source is the only thing between the reader and
 * a confident wrong answer.
 *
 * Both checks fail open. A failed check must never cost you a draft.
 */

export type CheckVerdict = "pass" | "warn" | "fail" | "skipped";

export interface FactCheckIssue {
  claim: string;
  problem: "unsupported" | "contradicted" | "overstated_certainty";
  detail: string;
}

export interface QualityCheckIssue {
  check: string;
  detail: string;
}

export interface DraftChecks {
  factCheck: {
    verdict: CheckVerdict;
    issues: FactCheckIssue[];
    error?: string;
  };
  qualityCheck: {
    verdict: CheckVerdict;
    score?: number;
    issues: QualityCheckIssue[];
    suggestion?: string;
    error?: string;
  };
  checkedAt: string;
}

/** Source text sent for verification. Enough for context, bounded for cost. */
const MAX_SOURCE_CHARS = 8000;

/**
 * A draft is stored as four fields but read as one piece of writing.
 *
 * The field names are labelled as structural, because without that note the
 * quality checker marks a perfectly good draft down for "using explicit
 * labels like QUESTION:" — scaffolding this function added, not something
 * the writer did.
 */
function draftAsText(draft: RewriteResult): string {
  return [
    "(The labels below are database field names, not part of the writing.)",
    "",
    `<question> ${draft.question}`,
    `<explanation> ${draft.explanation}`,
    `<interesting_detail> ${draft.interestingDetail}`,
    `<takeaway> ${draft.takeaway}`,
  ].join("\n\n");
}

export async function runFactCheck(
  draft: RewriteResult,
  sourceContent: string
): Promise<DraftChecks["factCheck"]> {
  if (!sourceContent?.trim()) {
    return {
      verdict: "skipped",
      issues: [],
      error: "No source content available to check against.",
    };
  }

  try {
    const parsed = await generateJson<{
      verdict?: CheckVerdict;
      issues?: FactCheckIssue[];
    }>(
      "fact check",
      composePrompt(loadPrompt("system"), loadPrompt("fact-checker")),
      [
        "DRAFT:",
        draftAsText(draft),
        "",
        "SOURCE:",
        sourceContent.slice(0, MAX_SOURCE_CHARS),
      ].join("\n")
    );

    return {
      verdict: parsed.verdict ?? "warn",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch (error) {
    console.warn(
      "[review] Fact check failed:",
      error instanceof Error ? error.message : error
    );

    return {
      verdict: "skipped",
      issues: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function runQualityCheck(
  draft: RewriteResult
): Promise<DraftChecks["qualityCheck"]> {
  try {
    const parsed = await generateJson<{
      verdict?: CheckVerdict;
      score?: number;
      issues?: QualityCheckIssue[];
      suggestion?: string;
    }>(
      "quality check",
      composePrompt(
        loadPrompt("system"),
        loadPrompt("quality-check"),
        loadRule("writing"),
        loadRule("banned_phrases"),
        loadRule("examples")
      ),
      draftAsText(draft)
    );

    return {
      verdict: parsed.verdict ?? "warn",
      score: typeof parsed.score === "number" ? parsed.score : undefined,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestion: parsed.suggestion || undefined,
    };
  } catch (error) {
    console.warn(
      "[review] Quality check failed:",
      error instanceof Error ? error.message : error
    );

    return {
      verdict: "skipped",
      issues: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/** Runs both checks. Never throws. */
export async function checkDraft(
  draft: RewriteResult,
  sourceContent: string
): Promise<DraftChecks> {
  // Sequential rather than parallel: the AI provider's rate limit is per
  // minute across all calls, and firing both at once reliably trips it.
  const factCheck = await runFactCheck(draft, sourceContent);
  const qualityCheck = await runQualityCheck(draft);

  return {
    factCheck,
    qualityCheck,
    checkedAt: new Date().toISOString(),
  };
}
