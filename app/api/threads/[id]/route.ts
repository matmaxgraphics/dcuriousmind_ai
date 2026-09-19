import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { requireEditor } from "@/lib/auth/session";
import {
  EDITABLE_DRAFT_STATUSES,
  EDITABLE_THREAD_STATUSES,
} from "@/lib/editorial/status";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const { id } = await params;

    const { data: thread, error } = await supabase
      .from("threads")
      .select(`
        id,
        draft_id,
        title,
        source_url,
        status,
        approved_at,
        published_at,
        x_thread_id,
        created_at,
        updated_at,
        thread_tweets (
          id,
          thread_id,
          position,
          text,
          created_at
        ),
        drafts (
          id,
          status,
          question,
          explanation,
          interesting_detail,
          takeaway,
          articles (
            id,
            title,
            url
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error || !thread) {
      return NextResponse.json(
        { success: false, error: "Thread not found" },
        { status: 404 }
      );
    }

    const tweets = Array.isArray(thread.thread_tweets)
      ? [...thread.thread_tweets].sort((a, b) => a.position - b.position)
      : [];

    const draftObj = Array.isArray(thread.drafts)
      ? thread.drafts[0]
      : thread.drafts;

    return NextResponse.json({
      success: true,
      thread: {
        ...thread,
        tweets,
        draft: draftObj ?? null,
      },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();

    // 1. Thread metadata and the thread's own editorial status.
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.source_url !== undefined) updateData.source_url = body.source_url;

    if (body.status !== undefined) {
      if (!EDITABLE_THREAD_STATUSES.includes(body.status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid thread status "${body.status}".`,
          },
          { status: 400 }
        );
      }

      updateData.status = body.status;

      // Stamp the approval, and clear it if the thread is moved back out of
      // the approved state.
      updateData.approved_at =
        body.status === "approved" ? new Date().toISOString() : null;
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();

      const { error: threadError } = await supabase
        .from("threads")
        .update(updateData)
        .eq("id", id);

      if (threadError) {
        throw new Error(`Failed to update thread: ${threadError.message}`);
      }
    }

    // 2. The draft's status is a separate editorial gate and is only touched
    //    when explicitly asked for. It is no longer how thread approval is
    //    recorded — that is threads.status above.
    if (body.draftStatus && body.draftId) {
      if (!EDITABLE_DRAFT_STATUSES.includes(body.draftStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid draft status "${body.draftStatus}".`,
          },
          { status: 400 }
        );
      }

      const { error: draftError } = await supabase
        .from("drafts")
        .update({
          status: body.draftStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.draftId);

      if (draftError) {
        throw new Error(`Failed to update draft status: ${draftError.message}`);
      }
    }

    // 3. Replace the tweets, without a window where the thread has none.
    //    The old code deleted every tweet and then inserted; a failed insert
    //    left the thread empty with no way back. Upserting on the unique
    //    (thread_id, position) key overwrites in place, and only then are
    //    any now-surplus positions removed.
    if (Array.isArray(body.tweets)) {
      const tweets: { thread_id: string; position: number; text: string }[] =
        body.tweets.map(
          (tw: { position?: number; text: string }, index: number) => ({
            thread_id: id,
            position: tw.position ?? index + 1,
            text: tw.text,
          })
        );

      if (tweets.length === 0) {
        return NextResponse.json(
          { success: false, error: "A thread must have at least one tweet." },
          { status: 400 }
        );
      }

      const { error: upsertError } = await supabase
        .from("thread_tweets")
        .upsert(tweets, { onConflict: "thread_id,position" });

      if (upsertError) {
        throw new Error(`Failed to save updated tweets: ${upsertError.message}`);
      }

      // Drop tweets beyond the new length (the thread got shorter).
      const highest = Math.max(...tweets.map((t) => t.position));

      const { error: trimError } = await supabase
        .from("thread_tweets")
        .delete()
        .eq("thread_id", id)
        .gt("position", highest);

      if (trimError) {
        throw new Error(`Failed to trim removed tweets: ${trimError.message}`);
      }
    }

    // Fetch updated thread
    const { data: updatedThread } = await supabase
      .from("threads")
      .select(`
        id,
        draft_id,
        title,
        source_url,
        status,
        approved_at,
        updated_at,
        thread_tweets (
          id,
          position,
          text
        )
      `)
      .eq("id", id)
      .single();

    return NextResponse.json({
      success: true,
      thread: updatedThread,
    });
  } catch (error) {
    console.error("Thread PATCH error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
