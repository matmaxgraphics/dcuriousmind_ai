import { NextRequest, NextResponse } from "next/server";
import { validateThread } from "@/lib/thread/validate";
import { requireEditor } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const body = await request.json();

    if (!body.tweets || !Array.isArray(body.tweets)) {
      return NextResponse.json(
        { success: false, error: "Tweets array is required." },
        { status: 400 }
      );
    }

    const title = body.title || "Untitled Thread";
    const sourceUrl = body.sourceUrl || "https://wikenigma.org";

    const threadObj = {
      title,
      sourceUrl,
      tweets: body.tweets.map(
        (tw: { position: number; text: string }, idx: number) => ({
          position: tw.position ?? idx + 1,
          text: tw.text || "",
        })
      ),
    };

    const errors = validateThread(threadObj);

    return NextResponse.json({
      success: true,
      isValid: errors.length === 0,
      errors,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
