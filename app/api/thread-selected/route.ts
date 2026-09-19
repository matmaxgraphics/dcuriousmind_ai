import { NextResponse } from "next/server";
import { runThreadGeneration } from "@/lib/pipeline/thread";
import { requireEditor } from "@/lib/auth/session";

export async function GET(request: Request) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const result = await runThreadGeneration();

    return NextResponse.json({
      success: true,
      ...(result.results.length === 0
        ? { message: "No drafts to turn into threads." }
        : {}),
      ...result,
    });
  } catch (error) {
    console.error("Thread generation error:", error);

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