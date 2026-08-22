import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "URL is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CuriousMind/1.0)",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Failed to fetch page: ${response.status}`,
        },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const links: {
      text: string;
      href: string;
    }[] = [];

    $("a").each((_, element) => {
      const text = $(element).text().trim();
      const href = $(element).attr("href");

      if (!href || !text) return;

      links.push({
        text,
        href: new URL(href, url).toString(),
      });
    });

    return NextResponse.json({
      page: {
        title: $("title").text().trim(),
        h1: $("h1").first().text().trim(),
      },
      links,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Inspection failed",
        details:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}