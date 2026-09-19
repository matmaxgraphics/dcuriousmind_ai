"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";

interface PipelineRun {
  id: string;
  status: "running" | "succeeded" | "partial" | "failed" | "skipped";
  trigger: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  articles_discovered: number;
  articles_saved: number;
  topics_scored: number;
  topics_selected: number;
  articles_extracted: number;
  drafts_generated: number;
  failed_stages: string[];
  error: string | null;
}

const STATUS_STYLES: Record<
  PipelineRun["status"],
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  running: {
    label: "Running",
    className:
      "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    Icon: Loader2,
  },
  succeeded: {
    label: "Succeeded",
    className:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    Icon: CheckCircle2,
  },
  partial: {
    label: "Partial",
    className:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    Icon: AlertTriangle,
  },
  failed: {
    label: "Failed",
    className: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    Icon: XCircle,
  },
  skipped: {
    label: "Skipped",
    className:
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    Icon: Clock,
  },
};

function formatWhen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;

  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;

  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export function PipelineStatus() {
  const [latest, setLatest] = useState<PipelineRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/pipeline/runs");
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to load pipeline runs.");
        }

        if (!cancelled) {
          setLatest(data.latest);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="h-24 animate-pulse rounded-xl border border-zinc-200/80 bg-white dark:border-zinc-800/80 dark:bg-zinc-900" />
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
        <p className="font-semibold">Could not load pipeline history:</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800/80 dark:bg-zinc-900">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <Activity className="h-4 w-4" />
          Automated pipeline
        </div>
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          No runs recorded yet. The scheduler will log its first run here.
        </p>
      </div>
    );
  }

  const style = STATUS_STYLES[latest.status];
  const { Icon } = style;

  const counts: { label: string; value: number }[] = [
    { label: "Discovered", value: latest.articles_discovered },
    { label: "Saved", value: latest.articles_saved },
    { label: "Scored", value: latest.topics_scored },
    { label: "Selected", value: latest.topics_selected },
    { label: "Extracted", value: latest.articles_extracted },
    { label: "Drafts", value: latest.drafts_generated },
  ];

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800/80 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <Activity className="h-4 w-4" />
          Last pipeline run
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.className}`}
          >
            <Icon
              className={`h-3 w-3 ${latest.status === "running" ? "animate-spin" : ""}`}
            />
            {style.label}
          </span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {formatWhen(latest.started_at)} · {formatDuration(latest.duration_ms)} ·{" "}
            {latest.trigger}
          </span>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-6">
        {counts.map((count) => (
          <div key={count.label}>
            <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {count.label}
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {count.value}
            </dd>
          </div>
        ))}
      </dl>

      {latest.failed_stages.length > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <span className="font-semibold">
            Failed {latest.failed_stages.length === 1 ? "stage" : "stages"}:
          </span>{" "}
          {latest.failed_stages.join(", ")}
          {latest.error && <span className="block mt-1">{latest.error}</span>}
        </p>
      )}
    </div>
  );
}
