"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  MessageSquare,
  ExternalLink,
  BookOpen,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { DraftChecksPanel, type DraftChecksData } from "@/components/dashboard/draft-checks";

interface DraftDetail {
  id: string;
  article_id: string;
  status: string;
  question: string;
  explanation: string;
  interesting_detail: string | null;
  takeaway: string | null;
  checks?: DraftChecksData | null;
  threadId: string | null;
  article?: {
    id: string;
    title: string;
    url: string;
    excerpt: string | null;
    content: string | null;
    topic_scores?: {
      overall: number;
      reason: string;
      curiosity_gap: number;
      surprise_factor: number;
    }[];
  } | null;
}

export default function DraftEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generatingThread, setGeneratingThread] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Editable Form State
  const [question, setQuestion] = useState("");
  const [explanation, setExplanation] = useState("");
  const [interestingDetail, setInterestingDetail] = useState("");
  const [takeaway, setTakeaway] = useState("");
  const [status, setStatus] = useState("draft");

  const fetchDraft = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/drafts/${id}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load draft.");
      }
      setDraft(data.draft);
      setQuestion(data.draft.question || "");
      setExplanation(data.draft.explanation || "");
      setInterestingDetail(data.draft.interesting_detail || "");
      setTakeaway(data.draft.takeaway || "");
      setStatus(data.draft.status || "draft");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error loading draft.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDraft();
  }, [id]);

  const handleSave = async (newStatus?: string) => {
    setSaving(true);
    setSaveSuccess(false);
    const targetStatus = newStatus || status;

    try {
      const res = await fetch(`/api/drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          explanation,
          interesting_detail: interestingDetail,
          takeaway,
          status: targetStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save draft.");
      }

      setStatus(targetStatus);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (
      !confirm(
        "Are you sure you want to regenerate this draft using OpenAI? Unsaved edits will be replaced."
      )
    ) {
      return;
    }

    setRegenerating(true);
    try {
      const res = await fetch(`/api/drafts/${id}/regenerate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Regeneration failed.");
      }
      await fetchDraft();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Regeneration failed.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleGenerateThread = async () => {
    setGeneratingThread(true);
    try {
      // Save any unsaved form edits first
      await handleSave();

      const res = await fetch(`/api/drafts/${id}/generate-thread`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate thread.");
      }

      router.push(`/dashboard/threads/${data.threadId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Thread generation failed.");
    } finally {
      setGeneratingThread(false);
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

  if (!draft) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/drafts"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Drafts
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          Draft not found.
        </div>
      </div>
    );
  }

  const scoreObj = draft.article?.topic_scores?.[0];

  return (
    <div className="space-y-6">
      {/* Back Navigation & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/80 pb-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/drafts"
            className="p-1.5 rounded-lg border border-zinc-200/80 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge status={status} />
              <span className="text-xs text-zinc-500 font-medium">
                Draft Editor
              </span>
            </div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 truncate max-w-lg mt-0.5">
              {draft.article?.title || "Untitled Topic"}
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`}
            />
            Regenerate Draft
          </button>

          <button
            onClick={() => handleSave("rejected")}
            disabled={saving || status === "rejected"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject
          </button>

          <button
            onClick={() => handleSave("approved")}
            disabled={saving || status === "approved"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Approve
          </button>

          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-900 shadow-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : saveSuccess ? "Saved!" : "Save"}
          </button>

          {/* Direct Link to Generated Thread if present */}
          {draft.threadId ? (
            <div className="flex items-center gap-1">
              <Link
                href={`/dashboard/threads/${draft.threadId}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-indigo-500 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                View Thread <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <button
                onClick={handleGenerateThread}
                disabled={generatingThread}
                title="Regenerate new thread from this draft"
                className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${generatingThread ? "animate-spin" : ""}`} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateThread}
              disabled={generatingThread}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
            >
              {generatingThread ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MessageSquare className="h-3.5 w-3.5" />
              )}
              Generate Thread
            </button>
          )}
        </div>
      </div>

      {/* Notice Banner if thread is generated */}
      {draft.threadId && (
        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-3.5 dark:border-indigo-900/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>An X thread has been generated for this draft.</span>
          </div>
          <Link
            href={`/dashboard/threads/${draft.threadId}`}
            className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
          >
            Open Thread Editor <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Dual Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main 2 Cols: Form Workspace */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-zinc-200/90 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-5">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <Sparkles className="h-4 w-4 text-amber-500" /> Editorial Explanation Fields
            </h2>

            {/* Question Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Question Hook
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Why do..."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-sm font-semibold text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:border-zinc-600 dark:focus:bg-zinc-900 dark:focus:ring-zinc-100/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <p className="text-[11px] text-zinc-400">
                The high-curiosity question that stops readers from scrolling.
              </p>
            </div>

            {/* Explanation Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Core Explanation
              </label>
              <textarea
                rows={8}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="The detailed, simplified explanation..."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 p-3.5 text-sm text-zinc-800 placeholder-zinc-400 leading-relaxed focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:border-zinc-600 dark:focus:bg-zinc-900 dark:focus:ring-zinc-100/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
              />
              <p className="text-[11px] text-zinc-400">
                Clear, jargon-free explanation written in the d_CuriousMind tone.
              </p>
            </div>

            {/* Interesting Detail */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Interesting Detail
              </label>
              <textarea
                rows={3}
                value={interestingDetail}
                onChange={(e) => setInterestingDetail(e.target.value)}
                placeholder="An extra surprising fact or detail..."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-800 placeholder-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:border-zinc-600 dark:focus:bg-zinc-900 dark:focus:ring-zinc-100/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
              />
            </div>

            {/* Takeaway */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Key Takeaway
              </label>
              <input
                type="text"
                value={takeaway}
                onChange={(e) => setTakeaway(e.target.value)}
                placeholder="The essential takeaway for the reader..."
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-sm font-semibold text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:border-zinc-600 dark:focus:bg-zinc-900 dark:focus:ring-zinc-100/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
          </div>
        </div>

        {/* Right Col: Source Context Side Panel */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <BookOpen className="h-4 w-4 text-zinc-500" /> Source Context
            </h3>

            {draft.article ? (
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Source Topic
                  </span>
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {draft.article.title}
                  </h4>
                  <a
                    href={draft.article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400 mt-1"
                  >
                    Open original article <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {scoreObj && (
                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950 text-xs space-y-1">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      Topic Score: {scoreObj.overall.toFixed(1)} / 10
                    </span>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 italic">
                      &ldquo;{scoreObj.reason}&rdquo;
                    </p>
                  </div>
                )}

                <DraftChecksPanel checks={draft.checks} />

                <div>
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Source Content / Excerpt
                  </span>
                  <div className="mt-1.5 max-h-72 overflow-y-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 leading-relaxed font-sans border border-zinc-100 dark:border-zinc-800">
                    {draft.article.content || draft.article.excerpt || "No source content available."}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">Associated article not loaded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
