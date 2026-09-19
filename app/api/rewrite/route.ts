import { NextRequest, NextResponse } from "next/server";

import { extractArticle } from "@/lib/extractor/article";
import { rewriteArticle } from "@/lib/rewrite/rewrite";
import { requirePipelineAuth } from "@/lib/auth/pipeline-auth";

// Developer/debugging endpoint. Not used by the dashboard, so it is behind
// the pipeline secret rather than open to the internet.
export async function GET(request: NextRequest) {
  const denied = requirePipelineAuth(request);
  if (denied) return denied;

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

    return NextResponse.json({
      source: article,
      rewritten,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Rewrite failed",
      },
      { status: 500 }
    );
  }
}