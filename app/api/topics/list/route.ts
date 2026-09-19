import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { requireEditor } from "@/lib/auth/session";

export async function GET(request: Request) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const { data: topics, error } = await supabase
      .from("articles")
      .select(`
        id,
        title,
        url,
        excerpt,
        content,
        status,
        discovered_at,
        sources (
          name
        ),
        topic_scores (
          overall,
          reason,
          curiosity_gap,
          surprise_factor
        ),
        drafts (
          id,
          status
        )
      `)
      .order("discovered_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch topics list: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      topics: topics || [],
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
