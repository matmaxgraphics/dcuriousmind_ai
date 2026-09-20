import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The editorial prompts live in markdown and are read with `fs` at request
  // time from paths built at runtime, which output file tracing cannot detect
  // statically. Without these entries the files are missing from a deployed
  // build and every rewrite and thread generation fails with ENOENT — while
  // working perfectly in local dev, where the whole project is on disk.
  outputFileTracingIncludes: {
    "/*": ["./prompts/**/*.md", "./rules/**/*.md"],
  },
};

export default nextConfig;
