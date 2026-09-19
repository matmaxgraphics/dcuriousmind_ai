import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { requireEditor } from "@/lib/auth/session";

export async function GET(request: Request) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const { data: drafts, error } = await supabase
      .from("drafts")
      .select(`
        id,
        article_id,
        status,
        question,
        explanation,
        interesting_detail,
        takeaway,
        created_at,
        updated_at,
        articles (
          id,
          title,
          url,
          topic_scores (
            overall,
            reason
          )
        ),
        threads (
          id
        )
      `)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch drafts: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      drafts: drafts || [],
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
