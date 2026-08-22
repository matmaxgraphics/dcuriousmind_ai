import { contentSources } from "./sources";
import type { DiscoveredArticle } from "./types";

export async function discoverArticles(): Promise<DiscoveredArticle[]> {
  const results = await Promise.all(
    contentSources.map(async (source) => {
      try {
        return await source.discover();
      } catch (error) {
        console.error(
          `[Discovery] Failed: ${source.name}`,
          error
        );

        return [];
      }
    })
  );

  return results.flat();
}