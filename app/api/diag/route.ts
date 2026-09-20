import { NextResponse } from "next/server";

/**
 * TEMPORARY DIAGNOSTIC — delete this file once the deployment is healthy.
 *
 * Routes that imported jsdom returned an empty 500 in production while
 * working in local dev, failing before any application code ran so nothing
 * reached the response body. This endpoint loads the suspect modules one at
 * a time inside try/catch and reports what breaks. jsdom has since been
 * replaced by linkedom; this verifies the replacement loads.
 *
 * Deliberately unauthenticated, because the auth layer itself is one of the
 * things being verified. It reports only WHETHER each secret is present —
 * never a value, a length, or a prefix.
 */

export const dynamic = "force-dynamic";

async function probe(
  name: string,
  load: () => Promise<unknown>
): Promise<{ module: string; ok: boolean; error?: string }> {
  try {
    await load();
    return { module: name, ok: true };
  } catch (error) {
    return {
      module: name,
      ok: false,
      error:
        error instanceof Error
          ? `${error.name}: ${error.message}`.slice(0, 400)
          : String(error).slice(0, 400),
    };
  }
}

export async function GET() {
  const modules = [
    await probe("linkedom", () => import("linkedom")),
    await probe("@mozilla/readability", () => import("@mozilla/readability")),
    await probe("cheerio", () => import("cheerio")),
    await probe("rss-parser", () => import("rss-parser")),
    await probe("openai", () => import("openai")),
    await probe("@/lib/extractor/article", () => import("@/lib/extractor/article")),
    await probe("@/lib/pipeline/run", () => import("@/lib/pipeline/run")),
  ];

  // Presence only. No values, no lengths, no prefixes.
  const required = [
    "GROQ_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ADMIN_PASSWORD",
    "SESSION_SECRET",
    "CRON_SECRET",
    "PIPELINE_SECRET",
  ];

  const env = Object.fromEntries(
    required.map((name) => [name, Boolean(process.env[name])])
  );

  // Can the prompt markdown be read from the deployed bundle?
  let prompts: { ok: boolean; detail: string };
  try {
    const { loadPrompt } = await import("@/lib/prompts/load");
    const text = loadPrompt("system");
    prompts = {
      ok: text.length > 0,
      detail: `prompts/system.md -> ${text.length} chars`,
    };
  } catch (error) {
    prompts = {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  return NextResponse.json({
    node: process.version,
    modules,
    env,
    prompts,
  });
}
