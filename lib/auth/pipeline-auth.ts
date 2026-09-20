import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Guards the endpoints that can spend money — anything that triggers AI calls.
 *
 * Fails closed: if no secret is configured the endpoint is unavailable rather
 * than open. An unset environment variable in production must never be the
 * thing standing between the internet and the OpenAI bill.
 */

export type AuthFailure =
  | { ok: false; reason: "unconfigured" }
  | { ok: false; reason: "unauthorized" };

export type AuthResult = { ok: true } | AuthFailure;

/**
 * Every secret a caller may legitimately present.
 *
 * PIPELINE_SECRET is ours, for manual and scripted runs. CRON_SECRET is the
 * name Vercel Cron injects as `Authorization: Bearer <value>` automatically.
 *
 * ANY of them is accepted, deliberately. An earlier version preferred
 * PIPELINE_SECRET and ignored CRON_SECRET when both were set — so with two
 * different values configured, Vercel Cron authenticated with CRON_SECRET,
 * got 401, and the scheduled run silently never happened. Precedence is the
 * wrong model here: these are alternative credentials, not a fallback chain.
 */
function configuredSecrets(): string[] {
  return [process.env.PIPELINE_SECRET, process.env.CRON_SECRET].filter(
    (secret): secret is string => Boolean(secret && secret.length > 0)
  );
}

function equals(a: string, b: string): boolean {
  // Hash first: timingSafeEqual throws on length mismatch, and the raw lengths
  // would leak the secret's length anyway. SHA-256 gives two fixed 32-byte
  // buffers to compare in constant time.
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();

  return timingSafeEqual(left, right);
}

export function authorizePipelineRequest(request: Request): AuthResult {
  const secrets = configuredSecrets();

  if (secrets.length === 0) {
    return { ok: false, reason: "unconfigured" };
  }

  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return { ok: false, reason: "unauthorized" };
  }

  const presented = header.slice("Bearer ".length).trim();

  // Compare against every configured secret. `equals` is constant-time, and
  // checking all of them regardless of an early match keeps it that way.
  const matched = secrets
    .map((secret) => equals(presented, secret))
    .some(Boolean);

  if (!presented || !matched) {
    return { ok: false, reason: "unauthorized" };
  }

  return { ok: true };
}

/**
 * The response to send when `authorizePipelineRequest` refuses. Kept here so
 * every protected route answers identically and none of them accidentally
 * explains which part of the check failed.
 */
export function authFailureResponse(failure: AuthFailure): Response {
  if (failure.reason === "unconfigured") {
    console.error(
      "[auth] Neither PIPELINE_SECRET nor CRON_SECRET is set — refusing to run the pipeline."
    );

    return Response.json(
      { success: false, error: "Pipeline endpoint is not configured." },
      { status: 503 }
    );
  }

  return Response.json(
    { success: false, error: "Unauthorized." },
    { status: 401 }
  );
}

/**
 * Convenience guard for route handlers: returns a Response to send back when
 * the request is not allowed, or null when it is.
 *
 *   const denied = requirePipelineAuth(request);
 *   if (denied) return denied;
 */
export function requirePipelineAuth(request: Request): Response | null {
  const auth = authorizePipelineRequest(request);

  return auth.ok ? null : authFailureResponse(auth);
}
