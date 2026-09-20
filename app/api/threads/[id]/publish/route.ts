import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/session";
import { publishThread, PublishError } from "@/lib/publish/publish-thread";

// POST only, and never reachable from the pipeline. Publishing is a human
// action on an already-approved thread.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const result = await publishThread(id);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          posted: error.posted,
        },
        { status: error.status }
      );
    }

    console.error("Publish error:", error);

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
