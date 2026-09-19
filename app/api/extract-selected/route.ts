import { NextResponse } from "next/server";
import { runExtraction } from "@/lib/pipeline/extract";
import { requireEditor } from "@/lib/auth/session";

export async function GET(request: Request) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const result = await runExtraction();

    return NextResponse.json({
      success: true,
      ...(result.results.length === 0
        ? { message: "No selected articles to extract." }
        : {}),
      ...result,
    });
  } catch (error) {
    console.error("Extraction error:", error);

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