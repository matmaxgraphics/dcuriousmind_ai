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

function configuredSecret(): string | undefined {
  // PIPELINE_SECRET is ours. CRON_SECRET is the name Vercel Cron injects as
  // `Authorization: Bearer <value>` automatically, so supporting it means the
  // scheduler needs no extra wiring.
  const secret =
    process.env.PIPELINE_SECRET ?? process.env.CRON_SECRET;

  return secret && secret.length > 0 ? secret : undefined;
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
  const secret = configuredSecret();

  if (!secret) {
    return { ok: false, reason: "unconfigured" };
  }

  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return { ok: false, reason: "unauthorized" };
  }

  const presented = header.slice("Bearer ".length).trim();

  if (!presented || !equals(presented, secret)) {
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
      "[auth] PIPELINE_SECRET (or CRON_SECRET) is not set — refusing to run the pipeline."
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
