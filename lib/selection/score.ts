import { openai, DEFAULT_AI_MODEL } from "@/lib/ai/client";
import type { DiscoveredArticle } from "@/lib/discovery/types";
import type { TopicScore } from "./types";

export async function scoreTopic(
  article: DiscoveredArticle
): Promise<TopicScore> {
  const response = await openai.chat.completions.create({
    model: DEFAULT_AI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
You are the topic-selection editor for d_CuriousMind.

d_CuriousMind publishes answers to questions people
never thought to ask.

The ideal topic makes someone think:

"I've never wondered about that before."

Evaluate the topic, not the quality of the source's writing.

Prefer:
- Everyday phenomena
- Counterintuitive facts
- Things people observe but rarely question
- Simple questions with surprisingly deep explanations
- Scientific mysteries that can be explained clearly
- Topics with a strong curiosity gap

Avoid:
- Generic news
- Highly technical research
- Medical topics that require clinical advice
- Political topics
- Topics requiring extensive context
- Topics that are interesting only to specialists

Score each category from 1 to 10.

Return JSON only with keys: interestingness, curiosityGap, everydayRelevance, surpriseFactor, explainability, overall, reason.
        `,
      },
      {
        role: "user",
        content: JSON.stringify({
          title: article.title,
          excerpt: article.excerpt,
          source: article.source,
        }),
      },
    ],
  });

  const text = response.choices[0]?.message?.content || "{}";

  return JSON.parse(text) as TopicScore;
}