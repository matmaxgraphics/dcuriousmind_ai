import { NextRequest, NextResponse } from "next/server";
import { extractArticle } from "@/lib/extractor/article";

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

    return NextResponse.json(article);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Article extraction failed",
      },
      { status: 500 }
    );
  }
}