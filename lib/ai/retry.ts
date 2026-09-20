/**
 * Retry wrapper for AI calls.
 *
 * Groq's on-demand tier caps tokens per minute (8,000 at time of writing).
 * Scoring a batch of articles in a tight loop reliably trips it — observed
 * for real: "Rate limit reached ... Limit 8000, Used 6595, Requested 1470".
 * A 429 there is expected traffic shaping, not a failure, so it is waited out
 * rather than surfaced as an error.
 */

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;

/** Never wait longer than this for a retry; the run budget is finite. */
const MAX_BACKOFF_MS = 8_000;

interface MaybeApiError {
  status?: number;
  message?: string;
}

/** Groq/OpenAI errors carry a status; 429 and 5xx are worth another try. */
function isRetryable(error: unknown): boolean {
  const status = (error as MaybeApiError)?.status;

  if (status === 429) return true;
  if (typeof status === "number" && status >= 500) return true;

  const message = (error as MaybeApiError)?.message ?? "";

  return /rate limit|timeout|ECONNRESET|fetch failed/i.test(message);
}

/**
 * Providers often state how long to wait ("try again in 487.5ms"). Honouring
 * that is more precise than guessing with pure exponential backoff.
 */
function suggestedDelayMs(error: unknown): number | null {
  const message = (error as MaybeApiError)?.message ?? "";

  const seconds = message.match(/try again in ([\d.]+)\s*s/i);
  if (seconds) return Math.ceil(Number(seconds[1]) * 1000);

  const millis = message.match(/try again in ([\d.]+)\s*ms/i);
  if (millis) return Math.ceil(Number(millis[1]));

  return null;
}

export async function withAiRetry<T>(
  label: string,
  call: () => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await call();
    } catch (error) {
      lastError = error;

      if (!isRetryable(error) || attempt === MAX_ATTEMPTS) {
        throw error;
      }

      // Add a little headroom over the provider's estimate: retrying at
      // exactly the stated moment tends to trip the limit again.
      // Providers sometimes ask for a wait longer than the whole run budget.
      // Waiting it out inside a serverless function just burns the budget and
      // gets the run killed; better to give up and let the next run retry.
      const requested =
        suggestedDelayMs(error) ?? BASE_DELAY_MS * 2 ** (attempt - 1);

      if (requested > MAX_BACKOFF_MS) {
        console.warn(
          `[ai] ${label} asked for a ${Math.round(requested / 1000)}s wait — abandoning, the next run will retry`
        );

        throw error;
      }

      const delay = requested + 250;

      console.warn(
        `[ai] ${label} attempt ${attempt} hit a rate limit or transient error; retrying in ${delay}ms`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
