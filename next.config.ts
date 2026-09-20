import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // jsdom uses Node-specific features and breaks when Next bundles it into a
  // serverless function: every route that imports it (through the article
  // extractor) returned an empty 500 in production while working fine in dev.
  // Opting it out makes Next `require` it natively at runtime instead.
  //
  // The failure is silent and total — the function never initialises, so no
  // application code runs and no error reaches the response body.
  serverExternalPackages: ["jsdom"],

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
