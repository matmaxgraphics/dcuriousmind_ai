import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { requireEditor } from "@/lib/auth/session";

export async function GET(request: Request) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const { data: threads, error } = await supabase
      .from("threads")
      .select(`
        id,
        draft_id,
        title,
        source_url,
        status,
        approved_at,
        published_at,
        created_at,
        updated_at,
        thread_tweets (
          id,
          position,
          text
        ),
        drafts (
          id,
          status,
          question
        )
      `)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch threads: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      threads: threads || [],
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
