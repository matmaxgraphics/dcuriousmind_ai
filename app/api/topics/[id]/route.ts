import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { requireEditor } from "@/lib/auth/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const { id } = await params;

    const { data: article, error } = await supabase
      .from("articles")
      .select(`
        id,
        source_id,
        title,
        url,
        excerpt,
        content,
        category,
        published_at,
        updated_at,
        discovered_at,
        status,
        sources (
          name,
          base_url
        ),
        topic_scores (
          id,
          interestingness,
          curiosity_gap,
          everyday_relevance,
          surprise_factor,
          explainability,
          overall,
          reason,
          created_at
        ),
        drafts (
          id,
          status,
          created_at
        )
      `)
      .eq("id", id)
      .single();

    if (error || !article) {
      return NextResponse.json(
        { success: false, error: "Topic not found" },
        { status: 404 }
      );
    }

    const sourceObj = Array.isArray(article.sources)
      ? article.sources[0]
      : article.sources;
    const scoreObj = Array.isArray(article.topic_scores)
      ? article.topic_scores[0]
      : article.topic_scores;
    const draftObj = Array.isArray(article.drafts)
      ? article.drafts[0]
      : article.drafts;

    return NextResponse.json({
      success: true,
      topic: {
        ...article,
        sourceName: sourceObj?.name ?? "Wikenigma",
        score: scoreObj ?? null,
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

    if (!body.status) {
      return NextResponse.json(
        { success: false, error: "Status is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("articles")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update topic status: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      topic: data,
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
