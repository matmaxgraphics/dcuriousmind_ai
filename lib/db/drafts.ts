import { supabase } from "@/lib/supabase/server";

import type { RewriteResult } from "@/lib/rewrite/rewrite";
import type { DraftChecks } from "@/lib/review/checks";

export async function saveDraft(
  articleId: string,
  draft: RewriteResult,
  checks?: DraftChecks
) {
  const { data, error } = await supabase
    .from("drafts")
    .insert({
      article_id: articleId,

      status: "draft",

      question: draft.question,
      explanation: draft.explanation,
      interesting_detail: draft.interestingDetail,
      takeaway: draft.takeaway,

      checks: checks ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(
      `Failed to save draft: ${error.message}`
    );
  }

  return data;
}

export async function getDraftByArticleId(articleId: string) {
  const { data, error } = await supabase
    .from("drafts")
    .select()
    .eq("article_id", articleId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to fetch draft by article id: ${error.message}`
    );
  }

  return data;
}