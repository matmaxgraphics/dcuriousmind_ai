import { supabase } from "@/lib/supabase/server";
import { scoreTopic } from "@/lib/selection/score";
import { saveTopicScore } from "@/lib/db/topic-scores";
import { decideSelection } from "@/lib/selection/decide";
import { noDeadline, type Deadline } from "./deadline";

export interface ScoringArticleResult {
  articleId: string;
  title: string;
  score: any;
}

export interface ScoringResult {
  scored: number;
  selected: number;
  rejected: number;
  errors: number;
  /** Left unscored this run because the per-run cap was reached. */
  deferred: number;
  articles: ScoringArticleResult[];
}

/**
 * Cost control. Scoring is one paid AI call per article, and five sources
 * produce ~110 items on a first run. Capping the batch keeps any single run's
 * spend bounded and predictable; whatever is left stays in `discovered` and is
 * picked up by the next run.
 */
const MAX_ARTICLES_PER_RUN = Number(
  process.env.MAX_ARTICLES_PER_SCORING_RUN ?? 5
);

/** Rough cost of scoring one article, allowing for rate-limit backoff. */
const SCORE_RESERVE_MS = 12_000;

export async function runScoring(
  deadline: Deadline = noDeadline()
): Promise<ScoringResult> {
  console.log("[pipeline] Starting scoring");

  // Count what is waiting so the result can report what was deferred.
  const { count: pendingCount } = await supabase
    .from("articles")
    .select("*", { count: "exact", head: true })
    .eq("status", "discovered");

  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, title, excerpt")
    .eq("status", "discovered")
    .order("discovered_at", { ascending: false })
    .limit(MAX_ARTICLES_PER_RUN);

  if (error) {
    throw new Error(`Failed to fetch articles for scoring: ${error.message}`);
  }

  const deferred = Math.max(
    0,
    (pendingCount ?? 0) - (articles?.length ?? 0)
  );

  if (deferred > 0) {
    console.log(
      `[pipeline] Scoring capped at ${MAX_ARTICLES_PER_RUN}; ${deferred} article(s) deferred to the next run`
    );
  }

  if (!articles || articles.length === 0) {
    console.log("[pipeline] Scoring complete: 0 scored, 0 selected, 0 rejected");
    return {
      scored: 0,
      selected: 0,
      rejected: 0,
      errors: 0,
      deferred: 0,
      articles: [],
    };
  }

  const scoredResults: ScoringArticleResult[] = [];
  let selectedCount = 0;
  let rejectedCount = 0;
  let errorCount = 0;

  for (const article of articles) {
    if (deadline.expired(SCORE_RESERVE_MS)) {
      console.log(
        "[pipeline] Scoring stopping early — run budget nearly spent"
      );
      break;
    }

    try {
      const score = await scoreTopic({
        title: article.title,
        excerpt: article.excerpt,
      });

      const decision = decideSelection(score);

      const saved = await saveTopicScore(article.id, {
        ...score,
        overall: decision.overall,
      });

      const status = decision.selected ? "selected" : "rejected";

      if (!decision.selected) {
        console.log(
          `[pipeline] Rejected "${article.title.slice(0, 60)}": ${decision.rejectionReason}`
        );
      }

      if (status === "selected") {
        selectedCount++;
      } else {
        rejectedCount++;
      }

      await supabase
        .from("articles")
        .update({ status })
        .eq("id", article.id);

      scoredResults.push({
        articleId: article.id,
        title: article.title,
        score: saved,
      });
    } catch (err) {
      errorCount++;
      console.error(`[pipeline] Scoring error for article ${article.id}:`, err);
    }
  }

  const result: ScoringResult = {
    scored: scoredResults.length,
    selected: selectedCount,
    rejected: rejectedCount,
    errors: errorCount,
    deferred,
    articles: scoredResults,
  };

  console.log(
    `[pipeline] Scoring complete: ${result.scored} scored, ${result.selected} selected, ${result.rejected} rejected`
  );

  return result;
}
