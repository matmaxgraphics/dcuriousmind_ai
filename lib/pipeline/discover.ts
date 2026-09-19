import { contentSources } from "@/lib/discovery/sources";
import { filterArticles } from "@/lib/selection/filter";
import { getSourceByName } from "@/lib/db/sources";
import { saveDiscoveredArticles } from "@/lib/db/articles";

export interface SourceDiscoveryResult {
  source: string;
  discovered: number;
  filtered: number;
  saved: number;
  status: "ok" | "skipped" | "error";
  reason?: string;
  error?: string;
}

export interface DiscoveryResult {
  discovered: number;
  filtered: number;
  saved: number;
  sources: SourceDiscoveryResult[];
}

export async function runDiscovery(): Promise<DiscoveryResult> {
  console.log("[pipeline] Starting discovery");

  const results: SourceDiscoveryResult[] = [];

  for (const source of contentSources) {
    // Each source is isolated: one dead feed must not cost us the others.
    try {
      // Resolve the database row first. Its id is what the articles are
      // attributed to, and its `active` flag is the per-source kill switch.
      const dbSource = await getSourceByName(source.name);

      if (!dbSource) {
        console.warn(
          `[pipeline] No sources row named "${source.name}" — skipping.`
        );

        results.push({
          source: source.name,
          discovered: 0,
          filtered: 0,
          saved: 0,
          status: "skipped",
          reason: "No matching row in the sources table.",
        });

        continue;
      }

      if (dbSource.active === false) {
        results.push({
          source: source.name,
          discovered: 0,
          filtered: 0,
          saved: 0,
          status: "skipped",
          reason: "Source is marked inactive.",
        });

        continue;
      }

      const discovered = await source.discover();
      const filtered = filterArticles(discovered, source);
      const saved = await saveDiscoveredArticles(filtered, dbSource.id);

      console.log(
        `[pipeline] ${source.name}: ${discovered.length} discovered, ${filtered.length} kept, ${saved.length} new`
      );

      results.push({
        source: source.name,
        discovered: discovered.length,
        filtered: filtered.length,
        saved: saved.length,
        status: "ok",
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown discovery error";

      console.error(`[pipeline] Discovery failed for ${source.name}:`, err);

      results.push({
        source: source.name,
        discovered: 0,
        filtered: 0,
        saved: 0,
        status: "error",
        error: message,
      });
    }
  }

  const result: DiscoveryResult = {
    discovered: results.reduce((sum, r) => sum + r.discovered, 0),
    filtered: results.reduce((sum, r) => sum + r.filtered, 0),
    saved: results.reduce((sum, r) => sum + r.saved, 0),
    sources: results,
  };

  console.log(
    `[pipeline] Discovery complete: ${result.discovered} discovered, ${result.filtered} filtered, ${result.saved} saved across ${results.length} source(s)`
  );

  return result;
}
