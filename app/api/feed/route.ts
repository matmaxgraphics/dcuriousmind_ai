import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://wikenigma.org.uk/feed.php", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CuriousMind/1.0)",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Feed request failed: ${response.status}`,
        },
        { status: response.status }
      );
    }

    const xml = await response.text();

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}