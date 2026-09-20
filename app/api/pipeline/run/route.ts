import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline/run";
import {
  authorizePipelineRequest,
  authFailureResponse,
} from "@/lib/auth/pipeline-auth";

// This route spends money on every call, so it always requires the bearer
// secret. Both verbs are exported on purpose:
//
//   GET  — Vercel Cron only ever issues GET, and signs it with CRON_SECRET.
//   POST — manual and scripted runs.
//
// `force-dynamic` keeps the GET out of the prerender/caching path, so a cached
// response can never be served in place of an actual run.

export const dynamic = "force-dynamic";
// 300 exceeds this Vercel plan's limit: the function then fails to
// initialise and every request returns an empty 500 before any code runs.
// 120 is verified to load on this account. Raise only after confirming the
// plan allows it.
export const maxDuration = 120;

async function handle(request: Request) {
  const auth = authorizePipelineRequest(request);

  if (!auth.ok) {
    return authFailureResponse(auth);
  }

  try {
    // Vercel Cron identifies itself with this header, which lets the run log
    // distinguish scheduled runs from ones you triggered by hand.
    const trigger = request.headers.get("user-agent")?.includes("vercel-cron")
      ? "cron"
      : "api";

    const result = await runPipeline(trigger);

    // 409: another run holds the lock. Nothing was spent, and a scheduler
    // retrying is harmless.
    if ("skipped" in result && result.skipped) {
      return NextResponse.json(result, { status: 409 });
    }

    // A partial failure is reported as 207 so the scheduler can tell the
    // difference between "ran cleanly" and "ran, but a stage broke".
    return NextResponse.json(result, {
      status: result.success ? 200 : 207,
    });
  } catch (error) {
    console.error("Pipeline run error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
