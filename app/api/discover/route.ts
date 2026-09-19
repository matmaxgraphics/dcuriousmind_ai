import { NextResponse } from "next/server";
import { runDiscovery } from "@/lib/pipeline/discover";
import { requireEditor } from "@/lib/auth/session";

export async function GET(request: Request) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const result = await runDiscovery();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Discovery error:", error);

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