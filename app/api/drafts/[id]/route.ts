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

    const { data: draft, error } = await supabase
      .from("drafts")
      .select(`
        id,
        article_id,
        status,
        question,
        explanation,
        interesting_detail,
        takeaway,
        checks,
        created_at,
        updated_at,
        articles (
          id,
          title,
          url,
          excerpt,
          content,
          topic_scores (
            overall,
            reason,
            curiosity_gap,
            surprise_factor,
            interestingness,
            everyday_relevance,
            explainability
          )
        ),
        threads (
          id
        )
      `)
      .eq("id", id)
      .single();

    if (error || !draft) {
      return NextResponse.json(
        { success: false, error: "Draft not found" },
        { status: 404 }
      );
    }

    const articleObj = Array.isArray(draft.articles)
      ? draft.articles[0]
      : draft.articles;
    const threadObj = Array.isArray(draft.threads)
      ? draft.threads[0]
      : draft.threads;

    return NextResponse.json({
      success: true,
      draft: {
        ...draft,
        article: articleObj ?? null,
        threadId: threadObj?.id ?? null,
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

    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.question !== undefined) updateFields.question = body.question;
    if (body.explanation !== undefined) updateFields.explanation = body.explanation;
    if (body.interesting_detail !== undefined) updateFields.interesting_detail = body.interesting_detail;
    if (body.takeaway !== undefined) updateFields.takeaway = body.takeaway;
    if (body.status !== undefined) updateFields.status = body.status;

    const { data, error } = await supabase
      .from("drafts")
      .update(updateFields)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update draft: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      draft: data,
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
