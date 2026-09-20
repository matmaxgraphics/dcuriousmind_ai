import { config } from "dotenv";
config({ path: ".env.local" });
process.env.PIPELINE_BUDGET_MS = "45000";   // exactly what production will use

(async () => {
  const { runPipeline } = await import("@/lib/pipeline/run");
  const t = Date.now();
  const r = await runPipeline("manual") as Record<string, any>;
  console.log("\n===== SUMMARY =====");
  console.log("success:", r.success, "| itemErrors:", r.itemErrors, "| skippedForTime:", JSON.stringify(r.skippedForTime));
  for (const k of ["rewrite","extraction","scoring","discovery"]) {
    const st = r[k]; const res = st?.result ?? {};
    console.log(k.padEnd(11), String(st?.status).padEnd(7), JSON.stringify(Object.fromEntries(Object.entries(res).filter(([a])=>!["results","articles","sources"].includes(a)))));
  }
  (r.rewrite?.result?.results ?? []).forEach((x: any) => console.log("  draft:", String(x.status).padEnd(7), (x.title||"").slice(0,54)));
  console.log(`\nwall clock: ${((Date.now()-t)/1000).toFixed(1)}s  (budget 45s, ceiling 60s)`);
})();
