import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { requirePipelineAuth } from "@/lib/auth/pipeline-auth";

// Developer/debugging endpoint. Not used by the dashboard, so it is behind
// the pipeline secret rather than open to the internet.
export async function GET(request: Request) {
  const denied = requirePipelineAuth(request);
  if (denied) return denied;

  const { data, error } = await supabase
    .from("sources")
    .select("*");

  if (error) {
    console.error("Supabase error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    sources: data,
  });
}