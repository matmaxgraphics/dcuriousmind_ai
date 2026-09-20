import OpenAI from "openai";
import type { AICompletionOptions, AIResponse } from "./types";

const apiKey =
  process.env.GROQ_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.OPEN_AI_KEY ||
  "unconfigured-api-key";

const isGroq = Boolean(
  process.env.GROQ_API_KEY || apiKey.startsWith("gsk_")
);

const baseURL =
  process.env.AI_BASE_URL ||
  (isGroq ? "https://api.groq.com/openai/v1" : undefined);

export const DEFAULT_AI_MODEL =
  process.env.AI_MODEL ||
  process.env.GROQ_MODEL ||
  process.env.OPENAI_MODEL ||
  // Verified available on this account and confirmed to honour JSON mode.
  //
  // NOT a compound/agentic model: groq/compound-mini was the original default
  // and caps at 30 requests per minute, which the scoring loop trips
  // immediately, and it routes internally so JSON output is less reliable.
  // llama-3.3-70b-versatile was tried and 404s — it is not on this account.
  // Check `GET /openai/v1/models` before changing this.
  (isGroq ? "openai/gpt-oss-120b" : "gpt-4o-mini");

export const openai = new OpenAI({
  apiKey,
  baseURL,
});

export async function generateCompletion(
  options: AICompletionOptions
): Promise<AIResponse> {
  const response = await openai.chat.completions.create({
    model: DEFAULT_AI_MODEL,
    messages: [
      ...(options.systemPrompt
        ? [{ role: "system" as const, content: options.systemPrompt }]
        : []),
      { role: "user" as const, content: options.prompt },
    ],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
  });

  return {
    text: response.choices[0]?.message?.content || "",
  };
}
