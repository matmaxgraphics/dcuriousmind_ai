"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Compass,
  FileCheck,
  FileText,
  MessageSquare,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Zap,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { PipelineStatus } from "@/components/dashboard/pipeline-status";

interface QueueItem {
  id: string;
  title: string;
  status: string;
  url: string;
  excerpt: string;
  discoveredAt: string;
  score: number | null;
  curiosityGap: number | null;
  surpriseFactor: number | null;
  reason: string;
  draftId: string | null;
  draftStatus: string | null;
}

interface Stats {
  discovered: number;
  selected: number;
  draftsAwaiting: number;
  threadsAwaiting: number;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning.";
    if (hour < 18) return "Good afternoon.";
    return "Good evening.";
  };

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/stats");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load dashboard statistics.");
      }
      setStats(data.stats);
      setQueue(data.queue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleGenerateDraft = async (topicId: string) => {
    setGeneratingId(topicId);
    try {
      const res = await fetch(`/api/topics/${topicId}/generate-draft`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate draft.");
      }
      await fetchOverview();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Draft generation failed.");
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {getGreeting()}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Here&apos;s what is happening in your curiosity pipeline.
          </p>
        </div>
        <button
          onClick={fetchOverview}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Pipeline
        </button>
      </div>

      {/* Automated pipeline health */}
      <PipelineStatus />

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-semibold">Pipeline connection error:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">
              Discovered
            </span>
            <Compass className="h-4 w-4 text-zinc-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
            {loading ? "..." : stats?.discovered ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Articles in repository
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">
              Selected
            </span>
            <FileCheck className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
            {loading ? "..." : stats?.selected ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Score ≥ 7.0 / 10
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">
              Drafts Review
            </span>
            <FileText className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
            {loading ? "..." : stats?.draftsAwaiting ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Drafts awaiting approval
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">
              Threads
            </span>
            <MessageSquare className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 tabular-nums">
            {loading ? "..." : stats?.threadsAwaiting ?? 0}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Generated X threads
          </p>
        </div>
      </div>

      {/* Editorial Queue */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Editorial Queue</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                High Priority
              </span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Highest-scoring curiosity topics requiring human review and draft creation.
            </p>
          </div>

          <Link
            href="/dashboard/topics"
            className="text-xs font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 flex items-center gap-1"
          >
            View all topics <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : queue.length === 0 ? (
          <EmptyState
            title="No topics in queue yet"
            description="Run discovery to bring new Wikenigma questions into your curiosity pipeline."
            action={
              <button
                onClick={() => fetch("/api/discover").then(() => fetchOverview())}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Run Discovery Now
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-zinc-200/90 bg-white p-5 hover:border-zinc-300 transition-all dark:border-zinc-800 dark:bg-zinc-900/90 dark:hover:border-zinc-700 shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <StatusBadge status={item.status} />
                    {item.score !== null && (
                      <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
                        <span>Score</span>
                        <span className="tabular-nums">{item.score.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 italic">
                      &ldquo;{item.reason}&rdquo;
                    </p>
                  </div>

                  {(item.curiosityGap !== null || item.surpriseFactor !== null) && (
                    <div className="flex items-center gap-4 pt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {item.curiosityGap !== null && (
                        <span>
                          Curiosity Gap: <strong className="text-zinc-800 dark:text-zinc-200">{item.curiosityGap}/10</strong>
                        </span>
                      )}
                      {item.surpriseFactor !== null && (
                        <span>
                          Surprise: <strong className="text-zinc-800 dark:text-zinc-200">{item.surpriseFactor}/10</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
                  <span className="text-[11px] text-zinc-400">
                    Discovered {new Date(item.discoveredAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-2">
                    {item.draftId ? (
                      <Link
                        href={`/dashboard/drafts/${item.draftId}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                      >
                        View Draft <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <>
                        <Link
                          href={`/dashboard/topics/${item.id}`}
                          className="inline-flex items-center rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          Review
                        </Link>
                        <button
                          onClick={() => handleGenerateDraft(item.id)}
                          disabled={generatingId === item.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                        >
                          {generatingId === item.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3" />
                          )}
                          Generate Draft
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
