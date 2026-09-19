import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { requireEditor } from "@/lib/auth/session";

export async function GET(request: Request) {
  const denied = requireEditor(request);
  if (denied) return denied;

  try {
    // 1. Fetch counts
    const { count: discoveredCount } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true });

    const { count: selectedCount } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .in("status", ["selected", "extracted", "processed"]);

    const { count: draftsCount } = await supabase
      .from("drafts")
      .select("*", { count: "exact", head: true })
      .eq("status", "draft");

    const { count: threadsCount } = await supabase
      .from("threads")
      .select("*", { count: "exact", head: true })
      .eq("status", "draft");

    // 2. Fetch top scored articles requiring review for the queue
    const { data: queueArticles, error: queueError } = await supabase
      .from("articles")
      .select(`
        id,
        title,
        status,
        url,
        excerpt,
        discovered_at,
        topic_scores (
          overall,
          curiosity_gap,
          surprise_factor,
          reason
        ),
        drafts (
          id,
          status
        )
      `)
      .order("discovered_at", { ascending: false })
      .limit(10);

    if (queueError) {
      throw new Error(`Failed to fetch editorial queue: ${queueError.message}`);
    }

    // Format queue items
    const queue = (queueArticles || []).map((art) => {
      const scoreObj = Array.isArray(art.topic_scores)
        ? art.topic_scores[0]
        : art.topic_scores;
      const draftObj = Array.isArray(art.drafts) ? art.drafts[0] : art.drafts;

      return {
        id: art.id,
        title: art.title,
        status: art.status,
        url: art.url,
        excerpt: art.excerpt,
        discoveredAt: art.discovered_at,
        score: scoreObj?.overall ?? null,
        curiosityGap: scoreObj?.curiosity_gap ?? null,
        surpriseFactor: scoreObj?.surprise_factor ?? null,
        reason: scoreObj?.reason ?? "Awaiting initial scoring.",
        draftId: draftObj?.id ?? null,
        draftStatus: draftObj?.status ?? null,
      };
    });

    // Sort queue by overall score descending
    queue.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return NextResponse.json({
      success: true,
      stats: {
        discovered: discoveredCount ?? 0,
        selected: selectedCount ?? 0,
        draftsAwaiting: draftsCount ?? 0,
        threadsAwaiting: threadsCount ?? 0,
      },
      queue: queue.slice(0, 6),
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
