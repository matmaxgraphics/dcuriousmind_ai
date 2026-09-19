import { NextResponse } from "next/server";
import { runScoring } from "@/lib/pipeline/score";
import { requireEditor } from "@/lib/auth/session";

export async function GET(request: Request) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const result = await runScoring();

    return NextResponse.json({
      success: true,
      ...(result.scored === 0
        ? { message: "No undiscovered articles to score." }
        : {}),
      ...result,
    });
  } catch (error) {
    console.error("Scoring error:", error);

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
