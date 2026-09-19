import { NextResponse } from "next/server";
import { runRewrite } from "@/lib/pipeline/rewrite";
import { requireEditor } from "@/lib/auth/session";

export async function GET(request: Request) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const result = await runRewrite();

    return NextResponse.json({
      success: true,
      ...(result.results.length === 0
        ? { message: "No extracted articles to rewrite." }
        : {}),
      ...result,
    });
  } catch (error) {
    console.error("Rewrite error:", error);

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