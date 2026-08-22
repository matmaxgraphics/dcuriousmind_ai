import { NextRequest, NextResponse } from "next/server";

import { extractArticle } from "@/lib/extractor/article";
import { rewriteArticle } from "@/lib/rewrite/rewrite";
import { generateThread } from "@/lib/thread/generate";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "URL is required" },
      { status: 400 }
    );
  }

  try {
    const article = await extractArticle(url);

    const rewritten = await rewriteArticle({
      title: article.title,
      content: article.content,
    });

    const thread = await generateThread({
      ...rewritten,
      title: article.title,
      sourceUrl: article.url,
    });

    return NextResponse.json({
      source: article,
      rewritten,
      thread,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Thread generation failed",
      },
      { status: 500 }
    );
  }
}