import { supabase } from "@/lib/supabase/server";
import { extractArticle } from "@/lib/extractor/article";
import { validateExtractedArticle } from "@/lib/extractor/validate";
import { saveExtractedContent } from "@/lib/db/articles";

export interface ExtractionItemResult {
  id: string;
  title: string;
  status: "extracted" | "rejected" | "error";
  reason?: string;
  error?: string;
}

export interface ExtractionResult {
  extracted: number;
  rejected: number;
  errors: number;
  results: ExtractionItemResult[];
}

export async function runExtraction(): Promise<ExtractionResult> {
  console.log("[pipeline] Starting extraction");

  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, title, url")
    .eq("status", "selected");

  if (error) {
    throw new Error(`Failed to fetch selected articles: ${error.message}`);
  }

  if (!articles || articles.length === 0) {
    console.log("[pipeline] Extraction complete: 0 extracted");
    return {
      extracted: 0,
      rejected: 0,
      errors: 0,
      results: [],
    };
  }

  const results: ExtractionItemResult[] = [];

  for (const article of articles) {
    try {
      const extracted = await extractArticle(article.url);

      const valid = validateExtractedArticle(extracted);

      if (!valid) {
        await supabase
          .from("articles")
          .update({
            status: "rejected",
          })
          .eq("id", article.id);

        results.push({
          id: article.id,
          title: article.title,
          status: "rejected",
          reason: "Extracted content failed validation.",
        });

        continue;
      }

      await saveExtractedContent(article.id, extracted.content);

      results.push({
        id: article.id,
        title: article.title,
        status: "extracted",
      });
    } catch (err) {
      results.push({
        id: article.id,
        title: article.title,
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "Unknown extraction error",
      });
    }
  }

  const extractedCount = results.filter((r) => r.status === "extracted").length;
  const rejectedCount = results.filter((r) => r.status === "rejected").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  const result: ExtractionResult = {
    extracted: extractedCount,
    rejected: rejectedCount,
    errors: errorCount,
    results,
  };

  console.log(`[pipeline] Extraction complete: ${result.extracted} extracted`);

  return result;
}
