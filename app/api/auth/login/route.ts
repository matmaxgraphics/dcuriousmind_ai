import { NextResponse } from "next/server";
import {
  createSessionToken,
  isAuthConfigured,
  verifyPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { success: false, error: "Authentication is not configured." },
      { status: 503 }
    );
  }

  let password = "";

  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request." },
      { status: 400 }
    );
  }

  if (!password || !verifyPassword(password)) {
    // Deliberately vague, and deliberately slow enough to make a remote
    // brute force unattractive without hurting a real login.
    await new Promise((resolve) => setTimeout(resolve, 500));

    return NextResponse.json(
      { success: false, error: "Incorrect password." },
      { status: 401 }
    );
  }

  const token = createSessionToken();

  if (!token) {
    return NextResponse.json(
      { success: false, error: "Authentication is not configured." },
      { status: 503 }
    );
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);

  return response;
}
