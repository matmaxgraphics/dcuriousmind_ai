import { NextResponse } from "next/server";
import { discoverArticles } from "@/lib/discovery";

export async function GET() {
  try {
    const articles = await discoverArticles();

    return NextResponse.json({
      count: articles.length,
      articles,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Discovery failed" },
      { status: 500 }
    );
  }
}