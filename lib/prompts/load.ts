import fs from "fs";
import path from "path";

/**
 * Loads prompts and editorial rules from markdown on disk, so the voice of
 * d_CuriousMind can be edited without touching TypeScript.
 *
 * These are read with `fs` at request time from paths built at runtime, which
 * Next's output file tracing cannot detect statically. `next.config.ts`
 * therefore declares `prompts/**` and `rules/**` under
 * `outputFileTracingIncludes`, otherwise the files are absent in a deployed
 * build and every rewrite fails with ENOENT.
 */

const cache = new Map<string, string>();

function read(directory: "prompts" | "rules", name: string): string {
  const key = `${directory}/${name}`;

  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const filePath = path.join(process.cwd(), directory, `${name}.md`);

  let contents = "";

  try {
    contents = fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    // A missing or unreadable file must not take the pipeline down. An empty
    // section simply drops out of the assembled prompt.
    console.warn(`[prompts] Could not read ${key}.md — continuing without it`);
  }

  cache.set(key, contents);

  return contents;
}

export type PromptName =
  | "system"
  | "rewrite"
  | "thread-generator"
  | "fact-checker"
  | "quality-check";

export type RuleName =
  | "writing"
  | "banned_phrases"
  | "examples"
  | "thread";

export function loadPrompt(name: PromptName): string {
  return read("prompts", name);
}

export function loadRule(name: RuleName): string {
  return read("rules", name);
}

/**
 * Joins sections, dropping any that are empty so a blank file leaves no
 * stray heading or whitespace behind in the prompt.
 */
export function composePrompt(...sections: (string | undefined)[]): string {
  return sections
    .map((section) => section?.trim())
    .filter((section): section is string => Boolean(section))
    .join("\n\n---\n\n");
}

/** Only used by tests and scripts; request paths should keep the cache. */
export function clearPromptCache(): void {
  cache.clear();
}
