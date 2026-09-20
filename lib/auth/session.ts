import {
  createHash,
  createHmac,
  timingSafeEqual,
  randomBytes,
} from "node:crypto";
import { cookies } from "next/headers";

/**
 * Single-operator admin session.
 *
 * One shared password, verified against ADMIN_PASSWORD, exchanged for a signed
 * cookie. The cookie carries an expiry and an HMAC over it, so it can be
 * validated without any server-side session store.
 *
 * This is deliberately the smallest thing that keeps the editorial actions
 * private. If d_CuriousMind ever gets a second editor, replace it with real
 * accounts rather than sharing the password.
 */

export const SESSION_COOKIE = "cm_session";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

function required(name: "ADMIN_PASSWORD" | "SESSION_SECRET"): string | undefined {
  const value = process.env[name];

  return value && value.length > 0 ? value : undefined;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEquals(a: string, b: string): boolean {
  // Hash first so lengths always match and nothing leaks through timing.
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();

  return timingSafeEqual(left, right);
}

export function isAuthConfigured(): boolean {
  return Boolean(required("ADMIN_PASSWORD") && required("SESSION_SECRET"));
}

export function verifyPassword(candidate: string): boolean {
  const password = required("ADMIN_PASSWORD");

  if (!password) {
    return false;
  }

  return safeEquals(candidate, password);
}

/** `<expiresAtMs>.<nonce>.<hmac>` */
export function createSessionToken(): string | null {
  const secret = required("SESSION_SECRET");

  if (!secret) {
    return null;
  }

  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const nonce = randomBytes(12).toString("hex");
  const payload = `${expiresAt}.${nonce}`;

  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  const secret = required("SESSION_SECRET");

  if (!secret || !token) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return false;
  }

  const [expiresAtRaw, nonce, signature] = parts;
  const payload = `${expiresAtRaw}.${nonce}`;

  if (!safeEquals(signature, sign(payload, secret))) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);

  // Check expiry only after the signature, so an attacker cannot learn
  // anything by supplying a forged token with a convenient timestamp.
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

/** For server components and layouts. */
export async function hasValidSession(): Promise<boolean> {
  const store = await cookies();

  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * For route handlers. Reads the cookie off the request directly so it works
 * regardless of how the handler was invoked.
 */
export function requestHasValidSession(request: Request): boolean {
  const header = request.headers.get("cookie");

  if (!header) {
    return false;
  }

  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");

    if (name === SESSION_COOKIE) {
      return verifySessionToken(rest.join("="));
    }
  }

  return false;
}

/**
 * Guard for editorial route handlers: returns a Response when the caller is
 * not allowed in, or null when they are.
 *
 * Also accepts the pipeline bearer secret, so scripted/scheduled callers can
 * use the same endpoints without a browser session.
 */
export function requireEditor(request: Request): Response | null {
  if (!isAuthConfigured()) {
    console.error(
      "[auth] ADMIN_PASSWORD / SESSION_SECRET are not set — refusing editorial request."
    );

    return Response.json(
      { success: false, error: "Authentication is not configured." },
      { status: 503 }
    );
  }

  if (requestHasValidSession(request)) {
    return null;
  }

  // Either configured secret is accepted, matching authorizePipelineRequest.
  // Treating one as taking precedence meant a scheduler signing with the
  // other was rejected.
  const bearer = request.headers.get("authorization");

  if (bearer?.startsWith("Bearer ")) {
    const presented = bearer.slice("Bearer ".length).trim();

    const accepted = [process.env.PIPELINE_SECRET, process.env.CRON_SECRET]
      .filter((secret): secret is string => Boolean(secret))
      .map((secret) => safeEquals(presented, secret))
      .some(Boolean);

    if (presented && accepted) {
      return null;
    }
  }

  return Response.json(
    { success: false, error: "Unauthorized." },
    { status: 401 }
  );
}
