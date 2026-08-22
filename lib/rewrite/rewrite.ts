import { openai, DEFAULT_AI_MODEL } from "@/lib/ai/client";
import { getWritingRules } from "./prompt";

interface RewriteResult {
  question: string;
  explanation: string;
  interestingDetail: string;
  takeaway: string;
}

export async function rewriteArticle(article: {
  title: string;
  content: string;
}): Promise<RewriteResult> {
  const rules = getWritingRules();

  const response = await openai.chat.completions.create({
    model: DEFAULT_AI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
You are the editor behind d_CuriousMind.

Your job is to transform source material into a
clear, curiosity-driven explanation.

You are NOT writing a generic social media post.

You are adapting the information into the established
voice of d_CuriousMind.

WRITING RULES:

${rules}

IMPORTANT:

- Preserve factual accuracy.
- Do not invent information.
- Do not copy sentences from the source.
- Do not exaggerate.
- Preserve uncertainty where appropriate.
- Focus on the most interesting explanation.
- Remove irrelevant information.

Return JSON with exactly these fields:

{
  "question": "...",
  "explanation": "...",
  "interestingDetail": "...",
  "takeaway": "..."
}
        `,
      },
      {
        role: "user",
        content: `
TITLE:
${article.title}

SOURCE:
${article.content}
        `,
      },
    ],
  });

  const content = response.choices[0]?.message?.content || "{}";
  return JSON.parse(content) as RewriteResult;
}