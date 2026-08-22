import fs from "fs";
import path from "path";

export function getWritingRules(): string {
  const rulesPath = path.join(
    process.cwd(),
    "rules",
    "writing.md"
  );

  return fs.readFileSync(rulesPath, "utf-8");
}