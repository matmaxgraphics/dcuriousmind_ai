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

    // 1. Fetch draft with associated article info
    const { data: draft, error: fetchError } = await supabase
      .from("drafts")
      .select(`
        id,
        article_id,
        question,
        explanation,
        interesting_detail,
        takeaway,
        articles (
          title,
          url
        )
      `)
      .eq("id", id)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json(
        { success: false, error: "Draft not found." },
        { status: 404 }
      );
    }

    const article = Array.isArray(draft.articles)
      ? draft.articles[0]
      : draft.articles;

    if (!article) {
      return NextResponse.json(
        { success: false, error: "Associated article not found." },
        { status: 400 }
      );
    }

    // 2. Clear any thread already generated for this draft so we regenerate
    //    rather than accumulate. Deletes by draft_id, not by a single id: if a
    //    draft ever ends up with more than one thread, every one of them has to
    //    go, otherwise the leftovers block the unique constraint. Tweets cascade.
    const { error: clearError } = await supabase
      .from("threads")
      .delete()
      .eq("draft_id", id);

    if (clearError) {
      throw new Error(
        `Failed to clear existing thread: ${clearError.message}`
      );
    }

    // 3. Generate thread using OpenAI
    const thread = await generateThread({
      title: article.title,
      question: draft.question,
      explanation: draft.explanation,
      interestingDetail: draft.interesting_detail ?? "",
      takeaway: draft.takeaway ?? "",
      sourceUrl: article.url,
    });

    // 4. Validate thread rules
    const validationErrors = validateThread(thread);
    if (validationErrors.length > 0) {
      // Save anyway if generated, but return warning errors
    }

    // 5. Save thread in database
    const saved = await saveThread(draft.id, thread);

    return NextResponse.json({
      success: true,
      threadId: saved.thread.id,
      thread: saved.thread,
      tweets: saved.tweets,
      validationErrors,
    });
  } catch (error) {
    console.error("Single thread generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
