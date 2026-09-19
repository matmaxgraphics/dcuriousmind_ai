import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { generateThread } from "@/lib/thread/generate";
import { validateThread } from "@/lib/thread/validate";
import { saveThread } from "@/lib/db/threads";
import { requireEditor } from "@/lib/auth/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const { id } = await params;

    // Fetch existing thread to get draft_id
    const { data: threadData, error: fetchError } = await supabase
      .from("threads")
      .select(`
        id,
        draft_id,
        drafts (
          id,
          question,
          explanation,
          interesting_detail,
          takeaway,
          articles (
            title,
            url
          )
        )
      `)
      .eq("id", id)
      .single();

    if (fetchError || !threadData) {
      return NextResponse.json(
        { success: false, error: "Thread not found" },
        { status: 404 }
      );
    }

    const draft = Array.isArray(threadData.drafts)
      ? threadData.drafts[0]
      : threadData.drafts;

    if (!draft) {
      return NextResponse.json(
        { success: false, error: "Associated draft not found" },
        { status: 400 }
      );
    }

    const article = Array.isArray(draft.articles)
      ? draft.articles[0]
      : draft.articles;

    if (!article) {
      return NextResponse.json(
        { success: false, error: "Associated article not found" },
        { status: 400 }
      );
    }

    // Delete old thread & tweets
    await supabase.from("thread_tweets").delete().eq("thread_id", id);
    await supabase.from("threads").delete().eq("id", id);

    // Re-generate thread using OpenAI
    const newThread = await generateThread({
      title: article.title,
      question: draft.question,
      explanation: draft.explanation,
      interestingDetail: draft.interesting_detail ?? "",
      takeaway: draft.takeaway ?? "",
      sourceUrl: article.url,
    });

    const validationErrors = validateThread(newThread);
    const saved = await saveThread(draft.id, newThread);

    return NextResponse.json({
      success: true,
      threadId: saved.thread.id,
      thread: saved.thread,
      tweets: saved.tweets,
      validationErrors,
    });
  } catch (error) {
    console.error("Thread regenerate error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
