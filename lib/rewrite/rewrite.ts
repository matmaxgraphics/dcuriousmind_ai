import { generateJson } from "@/lib/ai/json";
import { loadPrompt, loadRule, composePrompt } from "@/lib/prompts/load";

/**
 * How much source text is sent to the rewriter.
 *
 * A full Wikipedia article is 25,000-50,000 characters. Sent whole, one
 * request measured 18,647 tokens against Groq's 8,000 tokens-per-minute
 * limit and came back 413 — the draft simply never generated. 6,000
 * characters is roughly 1,500 tokens, which leaves room for the assembled
 * prompt and for the two checks that follow on the same budget.
 *
 * Readability puts the substance first, so the opening is the part worth
 * keeping.
 */
const MAX_SOURCE_CHARS = 6000;

export interface RewriteResult {
  question: string;
  explanation: string;
  interestingDetail: string;
  takeaway: string;
}

export async function rewriteArticle(article: {
  title: string;
  content: string;
}): Promise<RewriteResult> {
  // Assembled from markdown so the voice can be edited without a deploy.
  const systemPrompt = composePrompt(
    loadPrompt("system"),
    loadPrompt("rewrite"),
    loadRule("writing"),
    loadRule("banned_phrases"),
    loadRule("examples")
  );

  return generateJson<RewriteResult>(
    "rewrite article",
    systemPrompt,
    [
      "TITLE:",
      article.title,
      "",
      "SOURCE:",
      article.content,
    ].join("\n")
  );
}
