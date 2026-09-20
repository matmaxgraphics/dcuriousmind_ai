"use client";

import React from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  MinusCircle,
  Sparkles,
} from "lucide-react";

type Verdict = "pass" | "warn" | "fail" | "skipped";

export interface DraftChecksData {
  factCheck?: {
    verdict: Verdict;
    issues?: { claim: string; problem: string; detail: string }[];
    error?: string;
  };
  qualityCheck?: {
    verdict: Verdict;
    score?: number;
    issues?: { check: string; detail: string }[];
    suggestion?: string;
    error?: string;
  };
  checkedAt?: string;
}

const VERDICT = {
  pass: {
    label: "Pass",
    Icon: ShieldCheck,
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  warn: {
    label: "Check",
    Icon: ShieldAlert,
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  fail: {
    label: "Problem",
    Icon: ShieldX,
    chip: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  },
  skipped: {
    label: "Not run",
    Icon: MinusCircle,
    chip: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
} as const;

const PROBLEM_LABEL: Record<string, string> = {
  unsupported: "Not in source",
  contradicted: "Contradicts source",
  overstated_certainty: "Overstated certainty",
};

function Chip({ verdict }: { verdict: Verdict }) {
  const style = VERDICT[verdict] ?? VERDICT.skipped;
  const { Icon } = style;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.chip}`}
    >
      <Icon className="h-3 w-3" />
      {style.label}
    </span>
  );
}

export function DraftChecksPanel({ checks }: { checks?: DraftChecksData | null }) {
  if (!checks) {
    return null;
  }

  const fact = checks.factCheck;
  const quality = checks.qualityCheck;

  const factIssues = fact?.issues ?? [];
  const qualityIssues = quality?.issues ?? [];

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800/80 dark:bg-zinc-900">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <Sparkles className="h-4 w-4" />
        Automated review
      </h3>
      <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        Advisory only — these never block a draft. They point at what to read
        closely.
      </p>

      {/* Fact check */}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Supported by source
          </span>
          <Chip verdict={fact?.verdict ?? "skipped"} />
        </div>

        {fact?.error && (
          <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            {fact.error}
          </p>
        )}

        {factIssues.length > 0 && (
          <ul className="mt-2 space-y-2">
            {factIssues.map((issue, index) => (
              <li
                key={index}
                className="rounded-lg bg-zinc-50 p-2.5 text-[11px] dark:bg-zinc-800/60"
              >
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {PROBLEM_LABEL[issue.problem] ?? issue.problem}
                </span>
                <p className="mt-1 italic text-zinc-600 dark:text-zinc-400">
                  “{issue.claim}”
                </p>
                <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                  {issue.detail}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quality check */}
      <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Sounds like d_CuriousMind
            {typeof quality?.score === "number" && (
              <span className="ml-1.5 tabular-nums text-zinc-500 dark:text-zinc-400">
                {quality.score}/10
              </span>
            )}
          </span>
          <Chip verdict={quality?.verdict ?? "skipped"} />
        </div>

        {quality?.error && (
          <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            {quality.error}
          </p>
        )}

        {qualityIssues.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {qualityIssues.map((issue, index) => (
              <li
                key={index}
                className="text-[11px] text-zinc-700 dark:text-zinc-300"
              >
                <span className="font-medium">
                  {issue.check.replace(/_/g, " ")}:
                </span>{" "}
                {issue.detail}
              </li>
            ))}
          </ul>
        )}

        {quality?.suggestion && (
          <p className="mt-2 rounded-lg bg-sky-50 px-2.5 py-2 text-[11px] text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
            <span className="font-semibold">Suggested fix:</span>{" "}
            {quality.suggestion}
          </p>
        )}
      </div>
    </section>
  );
}
