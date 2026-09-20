import { openai, DEFAULT_AI_MODEL } from "./client";
import { withAiRetry } from "./retry";

/**
 * Single entry point for AI calls that must return JSON.
 *
 * Asking for JSON in the prompt is not enough. Observed in testing: a quality
 * check whose prompt said "Return JSON only" came back as prose beginning
 * "Why do we ...", the parse threw, and the check was silently skipped. The
 * provider's JSON mode makes that a protocol guarantee rather than a request.
 *
 * Every JSON-returning call goes through here so none can drift back to
 * hoping the model complies.
 */
export async function generateJson<T>(
  label: string,
  systemPrompt: string,
  userContent: string
): Promise<T> {
  const response = await withAiRetry(label, () =>
    openai.chat.completions.create({
      model: DEFAULT_AI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    })
  );

  const text = response.choices[0]?.message?.content;

  if (!text) {
    throw new Error(`${label}: model returned an empty response`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    // Include a snippet: knowing what came back instead is the difference
    // between a five-minute fix and an afternoon.
    throw new Error(
      `${label}: expected JSON, got "${text.slice(0, 120)}"`
    );
  }
}
