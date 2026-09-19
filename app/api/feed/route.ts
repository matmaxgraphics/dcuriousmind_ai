import { NextResponse } from "next/server";
import { requirePipelineAuth } from "@/lib/auth/pipeline-auth";

// Developer/debugging endpoint. Not used by the dashboard, so it is behind
// the pipeline secret rather than open to the internet.
export async function GET(request: Request) {
  const denied = requirePipelineAuth(request);
  if (denied) return denied;

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