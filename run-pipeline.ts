import { config } from "dotenv";
config({ path: ".env.local" });

(async () => {
  const { runPipeline } = await import("@/lib/pipeline/run");
  const started = Date.now();
  const result = await runPipeline("manual");
  console.log("\n================ RESULT ================");
  console.log(JSON.stringify(result, null, 2).slice(0, 8000));
  console.log(`\nwall clock: ${((Date.now() - started) / 1000).toFixed(1)}s`);
})();
