import { NextResponse } from "next/server";
import { getRecentRuns } from "@/lib/db/pipeline-runs";
import { requireEditor } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const runs = await getRecentRuns(10);

    return NextResponse.json({
      success: true,
      latest: runs?.[0] ?? null,
      runs: runs ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
