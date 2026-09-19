import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { extractArticle } from "@/lib/extractor/article";
import { validateExtractedArticle } from "@/lib/extractor/validate";
import { saveExtractedContent } from "@/lib/db/articles";
import { rewriteArticle } from "@/lib/rewrite/rewrite";
import { saveDraft } from "@/lib/db/drafts";
import { requireEditor } from "@/lib/auth/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    const { id } = await params;

    // 1. Fetch article
    const { data: article, error: fetchError } = await supabase
      .from("articles")
      .select("id, title, url, content, status")
      .eq("id", id)
      .single();

    if (fetchError || !article) {
      return NextResponse.json(
        { success: false, error: "Topic not found." },
        { status: 404 }
      );
    }

    let articleContent = article.content;

    // 2. Extract content if missing
    if (!articleContent || !articleContent.trim()) {
      const extracted = await extractArticle(article.url);
      const isValid = validateExtractedArticle(extracted);

      if (!isValid) {
        await supabase
          .from("articles")
          .update({ status: "rejected" })
          .eq("id", article.id);

        return NextResponse.json(
          {
            success: false,
            error: "Extracted article content failed quality validation.",
          },
          { status: 422 }
        );
      }

      await saveExtractedContent(article.id, extracted.content);
      articleContent = extracted.content;
    }

    // 3. Rewrite article into draft
    const draftContent = await rewriteArticle({
      title: article.title,
      content: articleContent,
    });

    // 4. Save draft in database
    const savedDraft = await saveDraft(article.id, draftContent);

    // 5. Update article status to processed
    await supabase
      .from("articles")
      .update({ status: "processed" })
      .eq("id", article.id);

    return NextResponse.json({
      success: true,
      draft: savedDraft,
    });
  } catch (error) {
    console.error("Single draft generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
