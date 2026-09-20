import { supabase } from "@/lib/supabase/server";
import { DEFAULT_AI_MODEL } from "@/lib/ai/client";
import type { TopicScore } from "@/lib/selection/types";

export async function saveTopicScore(
  articleId: string,
  score: TopicScore
) {
  const { data, error } = await supabase
    .from("topic_scores")
    .insert({
      article_id: articleId,

      phenomenon_type: score.phenomenonType,

      interestingness: score.interestingness,
      curiosity_gap: score.curiosityGap,
      everyday_relevance: score.everydayRelevance,
      surprise_factor: score.surpriseFactor,
      explainability: score.explainability,

      overall: score.overall,
      reason: score.reason,

      model: DEFAULT_AI_MODEL,
    })
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to save topic score: ${error.message}`
    );
  }

  return data;
}