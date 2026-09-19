"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Sparkles,
  Zap,
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { ScoreBar } from "@/components/ui/score-bar";
import { CardSkeleton } from "@/components/ui/loading-skeleton";

interface TopicDetail {
  id: string;
  title: string;
  url: string;
  excerpt: string | null;
  content: string | null;
  status: string;
  discovered_at: string;
  sourceName: string;
  score?: {
    overall: number;
    interestingness: number;
    curiosity_gap: number;
    everyday_relevance: number;
    surprise_factor: number;
    explainability: number;
    reason: string;
  } | null;
  draft?: {
    id: string;
    status: string;
  } | null;
}

export default function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/topics/${id}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load topic details.");
      }
      setTopic(data.topic);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleGenerateDraft = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/topics/${id}/generate-draft`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate draft.");
      }
      fetchDetail();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/topics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update status.");
      }
      setTopic((prev) => (prev ? { ...prev, status: newStatus } : null));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Status update failed.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/topics"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Topics
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          {error || "Topic not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Back Navigation */}
      <div>
        <Link
          href="/dashboard/topics"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Topics
        </Link>
      </div>

      {/* Header & Core Metadata */}
      <div className="rounded-xl border border-zinc-200/80 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={topic.status} />
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Source: {topic.sourceName}
            </span>
          </div>

          <span className="text-xs text-zinc-400">
            Discovered {new Date(topic.discovered_at).toLocaleDateString()}
          </span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {topic.title}
        </h1>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleUpdateStatus("selected")}
              disabled={updatingStatus || topic.status === "selected"}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              <CheckCircle className="h-3.5 w-3.5" /> Approve Topic
            </button>
            <button
              onClick={() => handleUpdateStatus("rejected")}
              disabled={updatingStatus || topic.status === "rejected"}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-40 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <XCircle className="h-3.5 w-3.5" /> Reject Topic
            </button>
          </div>

          <div>
            {topic.draft ? (
              <Link
                href={`/dashboard/drafts/${topic.draft.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-xs"
              >
                <FileText className="h-4 w-4" /> View Draft
              </Link>
            ) : (
              <button
                onClick={handleGenerateDraft}
                disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-xs"
              >
                {generating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Generate Draft
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Score breakdown & Editorial Reason */}
        <div className="lg:col-span-2 space-y-6">
          {/* Score Breakdown Card */}
          <div className="rounded-xl border border-zinc-200/80 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Editorial Score Breakdown
              </h2>
              {topic.score && (
                <div className="text-right">
                  <span className="text-xs text-zinc-400">Overall Score</span>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {topic.score.overall.toFixed(1)} / 10
                  </p>
                </div>
              )}
            </div>

            {topic.score ? (
              <div className="space-y-4">
                <ScoreBar
                  label="Curiosity Gap"
                  score={topic.score.curiosity_gap}
                  description="Distance between assumptions and actual underlying explanation."
                />
                <ScoreBar
                  label="Surprise Factor"
                  score={topic.score.surprise_factor}
                  description="How counter-intuitive or unexpected the outcome is."
                />
                <ScoreBar
                  label="Everyday Relevance"
                  score={topic.score.everyday_relevance}
                  description="Connection to common objects, experiences, or human observations."
                />
                <ScoreBar
                  label="Interestingness"
                  score={topic.score.interestingness}
                  description="Inherent subject magnetism and attention capture."
                />
                <ScoreBar
                  label="Explainability"
                  score={topic.score.explainability}
                  description="Clarity of explanation within a 5-7 tweet sequence."
                />
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-zinc-500">
                This topic has not been scored by OpenAI topic evaluation yet.
              </div>
            )}
          </div>

          {/* AI Editorial Rationale */}
          {topic.score?.reason && (
            <div className="rounded-xl border border-zinc-200/80 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-indigo-500" />
                Why this topic?
              </h2>
              <div className="rounded-lg bg-zinc-50 p-4 border border-zinc-200/60 dark:bg-zinc-950 dark:border-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed italic">
                &ldquo;{topic.score.reason}&rdquo;
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Source Material */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200/80 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Source Material
              </h2>
              <a
                href={topic.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Open source <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div>
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Excerpt
              </span>
              <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {topic.excerpt || "No excerpt available."}
              </p>
            </div>

            {topic.content && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Extracted Content Preview
                </span>
                <div className="mt-1.5 max-h-60 overflow-y-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400 font-mono">
                  {topic.content}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
