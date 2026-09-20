import { generateJson } from "@/lib/ai/json";
import { loadPrompt, loadRule, composePrompt } from "@/lib/prompts/load";
import type { GeneratedThread } from "./types";

interface RewriteResult {
  question: string;
  explanation: string;
  interestingDetail: string;
  takeaway: string;
}

export async function generateThread(
  article: RewriteResult & {
    title: string;
    sourceUrl: string;
  }
): Promise<GeneratedThread> {
  const systemPrompt = composePrompt(
    loadPrompt("system"),
    loadPrompt("thread-generator"),
    loadRule("writing"),
    loadRule("thread"),
    loadRule("banned_phrases"),
    loadRule("examples")
  );

  const result = await generateJson<Omit<GeneratedThread, "sourceUrl">>(
    "generate thread",
    systemPrompt,
    JSON.stringify({
      title: article.title,
      question: article.question,
      explanation: article.explanation,
      interestingDetail: article.interestingDetail,
      takeaway: article.takeaway,
      sourceUrl: article.sourceUrl,
    })
  );

  return {
    ...result,
    sourceUrl: article.sourceUrl,
  };
}