import { openai, DEFAULT_AI_MODEL } from "@/lib/ai/client";

import type { DiscoveredArticle } from "@/lib/discovery/types";
import type { TopicScore } from "./types";

export async function scoreTopic(
  article: Pick<
    DiscoveredArticle,
    "title" | "excerpt"
  >
): Promise<TopicScore> {
  const response = await openai.responses.create({
    model: DEFAULT_AI_MODEL,

    input: [
      {
        role: "system",
        content: `
You are the editorial topic selector for d_CuriousMind.

Your job is to determine whether a topic is worth turning
into a d_CuriousMind post.

d_CuriousMind explains things people observe but rarely
question.

We are NOT asking:

"Is this scientifically interesting?"

We are asking:

"Would someone stop scrolling and think,
"I've never wondered about that"?"

Score the topic from 1 to 10 on each dimension:

- interestingness
- curiosityGap
- everydayRelevance
- surpriseFactor
- explainability

Then calculate an overall score from 1 to 10.

Scoring guidance:

interestingness:
How inherently interesting is the subject?

curiosityGap:
How strongly does the topic create a gap between
what someone assumes and what is actually happening?

everydayRelevance:
How connected is this to things ordinary people
see, experience, or encounter?

surpriseFactor:
How surprising is the explanation likely to be?

explainability:
Can the idea be explained clearly in a short thread?

A strong d_CuriousMind topic usually has a strong
curiosity gap and can be explained without excessive
technical detail.

Do not reward a topic merely because it is academically
important.

Return JSON only:

{
  "interestingness": number,
  "curiosityGap": number,
  "everydayRelevance": number,
  "surpriseFactor": number,
  "explainability": number,
  "overall": number,
  "reason": "short editorial explanation"
}

Do not invent information that is not present in the
title or excerpt.
        `,
      },
      {
        role: "user",
        content: `
TITLE:
${article.title}

EXCERPT:
${article.excerpt ?? "No excerpt available."}
        `,
      },
    ],
  });

  return JSON.parse(response.output_text) as TopicScore;
}