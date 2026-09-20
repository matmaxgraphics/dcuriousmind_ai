import { createHmac, randomBytes } from "node:crypto";

/**
 * Minimal OAuth 1.0a user-context client for the X API.
 *
 * Implemented directly rather than pulled in as a dependency: the signing
 * algorithm is small and fully specified, and this is a credential-handling
 * path where fewer third-party packages is worth more than fewer lines.
 */

const API_BASE = "https://api.x.com/2";

export interface XCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export class XApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown
  ) {
    super(message);
    this.name = "XApiError";
  }
}

export function getCredentials(): XCredentials | null {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    return null;
  }

  return { apiKey, apiSecret, accessToken, accessTokenSecret };
}

/** RFC 3986 percent encoding. encodeURIComponent leaves these four alone. */
function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function buildAuthHeader(
  method: "GET" | "POST",
  url: string,
  credentials: XCredentials,
  queryParams: Record<string, string> = {}
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
  };

  // A JSON request body is deliberately excluded from the signature base
  // string — only oauth_* and query parameters are signed.
  const signatureParams = { ...oauthParams, ...queryParams };

  const parameterString = Object.keys(signatureParams)
    .sort()
    .map(
      (key) => `${percentEncode(key)}=${percentEncode(signatureParams[key])}`
    )
    .join("&");

  const baseString = [
    method,
    percentEncode(url),
    percentEncode(parameterString),
  ].join("&");

  const signingKey = `${percentEncode(credentials.apiSecret)}&${percentEncode(
    credentials.accessTokenSecret
  )}`;

  const signature = createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  const headerParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };

  return (
    "OAuth " +
    Object.keys(headerParams)
      .sort()
      .map(
        (key) => `${percentEncode(key)}="${percentEncode(headerParams[key])}"`
      )
      .join(", ")
  );
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  credentials: XCredentials,
  body?: unknown
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: buildAuthHeader(method, url, credentials),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });

  const text = await response.text();

  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    // Log the raw body: X's error shapes vary by failure type, and the
    // summarised message necessarily drops detail worth having when
    // diagnosing a refusal.
    console.error(
      `[publish] X ${method} ${path} -> ${response.status}:`,
      typeof payload === "string" ? payload.slice(0, 500) : payload
    );

    throw new XApiError(
      describeError(response.status, payload),
      response.status,
      payload
    );
  }

  return payload as T;
}

/** Turns X's error responses into something actionable. */
function describeError(status: number, payload: unknown): string {
  const detail =
    payload &&
    typeof payload === "object" &&
    "detail" in payload &&
    typeof (payload as { detail: unknown }).detail === "string"
      ? (payload as { detail: string }).detail
      : undefined;

  switch (status) {
    case 401:
      return "X rejected the credentials (401). Check the four X_* values in .env.local.";
    case 402:
      // Billing, not a bug: the request was authenticated and well-formed,
      // and X declined it for lack of API credits/quota on the account.
      return `X declined the request for billing reasons (402): the app has no API credits left. Check usage and plan at developer.x.com. Nothing was posted.${
        detail ? ` X said: ${detail}` : ""
      }`;
    case 403:
      return `X refused the request (403). Usually this means the access token lacks write permission, or the text duplicates a recent post.${
        detail ? ` X said: ${detail}` : ""
      }`;
    case 429:
      return "X rate limit reached (429). The monthly post cap on the Free tier is low; wait or upgrade the tier.";
    default:
      return `X API request failed (${status}).${detail ? ` ${detail}` : ""}`;
  }
}

export interface PostedTweet {
  id: string;
  text: string;
}

/** Posts one tweet, optionally as a reply — this is how a thread is chained. */
export async function postTweet(
  credentials: XCredentials,
  text: string,
  inReplyToTweetId?: string
): Promise<PostedTweet> {
  const body: Record<string, unknown> = { text };

  if (inReplyToTweetId) {
    body.reply = { in_reply_to_tweet_id: inReplyToTweetId };
  }

  const result = await request<{ data: PostedTweet }>(
    "POST",
    "/tweets",
    credentials,
    body
  );

  return result.data;
}

/** Read-only identity check — confirms which account would be posted to. */
export async function getAuthenticatedUser(
  credentials: XCredentials
): Promise<{ id: string; username: string; name: string }> {
  const result = await request<{
    data: { id: string; username: string; name: string };
  }>("GET", "/users/me", credentials);

  return result.data;
}
