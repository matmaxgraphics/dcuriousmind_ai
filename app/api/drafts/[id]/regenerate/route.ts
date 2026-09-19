import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { rewriteArticle } from "@/lib/rewrite/rewrite";
import { requireEditor } from "@/lib/auth/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const { id } = await params;

    // 1. Fetch draft with associated article content
    const { data: draft, error: fetchError } = await supabase
      .from("drafts")
      .select(`
        id,
        article_id,
        articles (
          id,
          title,
          content
        )
      `)
      .eq("id", id)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json(
        { success: false, error: "Draft not found" },
        { status: 404 }
      );
    }

    const article = Array.isArray(draft.articles)
      ? draft.articles[0]
      : draft.articles;

    if (!article || !article.content?.trim()) {
      return NextResponse.json(
        { success: false, error: "Associated article content is missing." },
        { status: 400 }
      );
    }

    // 2. Re-run AI rewrite
    const newContent = await rewriteArticle({
      title: article.title,
      content: article.content,
    });

    // 3. Update draft record
    const { data: updatedDraft, error: updateError } = await supabase
      .from("drafts")
      .update({
        question: newContent.question,
        explanation: newContent.explanation,
        interesting_detail: newContent.interestingDetail,
        takeaway: newContent.takeaway,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update regenerated draft: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      draft: updatedDraft,
    });
  } catch (error) {
    console.error("Regenerate draft error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
