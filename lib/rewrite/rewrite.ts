import { generateJson } from "@/lib/ai/json";
import { loadPrompt, loadRule, composePrompt } from "@/lib/prompts/load";

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
