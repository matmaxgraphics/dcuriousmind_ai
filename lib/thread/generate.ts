import { openai, DEFAULT_AI_MODEL } from "@/lib/ai/client";
import { getWritingRules } from "@/lib/rewrite/prompt";
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
  const rules = getWritingRules();

  const response = await openai.responses.create({
    model: DEFAULT_AI_MODEL,

    input: [
      {
        role: "system",
        content: `
You are the thread editor for d_CuriousMind.

d_CuriousMind answers questions people never thought
to ask.

Turn the provided explanation into a compelling X thread.

WRITING RULES:

${rules}

THREAD RULES:

1. Create 5–7 tweets.

2. Tweet 1 must stand on its own and create curiosity.

3. Prefer opening with a question when appropriate.

4. Do not reveal the answer immediately.

5. Each tweet should advance the explanation.

6. Do not simply split paragraphs into tweets.

7. Keep each tweet concise.

8. Avoid unnecessary jargon.

9. Do not use fake suspense.

10. Do not use phrases such as:
   - "You won't believe..."
   - "This will blow your mind"
   - "Here's the shocking truth"
   - "Wait until you see..."

11. Do not repeat the same information.

12. Preserve scientific uncertainty.

13. Do not introduce facts that are not present
    in the supplied material.

14. The final tweet should provide a satisfying conclusion.

15. The thread should feel like a human explaining
    something they genuinely found interesting.

Return JSON only:

{
  "title": "...",
  "tweets": [
    {
      "position": 1,
      "text": "..."
    }
  ]
}
        `,
      },
      {
        role: "user",
        content: JSON.stringify({
          title: article.title,
          question: article.question,
          explanation: article.explanation,
          interestingDetail: article.interestingDetail,
          takeaway: article.takeaway,
          sourceUrl: article.sourceUrl,
        }),
      },
    ],
  });

  const result = JSON.parse(
    response.output_text
  ) as Omit<GeneratedThread, "sourceUrl">;

  return {
    ...result,
    sourceUrl: article.sourceUrl,
  };
}