"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  ExternalLink,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { validateThread } from "@/lib/thread/validate";

interface TweetItem {
  id?: string;
  position: number;
  text: string;
}

interface ThreadDetail {
  id: string;
  draft_id: string;
  title: string;
  source_url: string;
  updated_at: string;
  tweets: TweetItem[];
  draft?: {
    id: string;
    status: string;
    question: string;
  } | null;
}

export default function ThreadEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [title, setTitle] = useState("");
  const [tweets, setTweets] = useState<TweetItem[]>([]);
  const [threadStatus, setThreadStatus] = useState("draft");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchThread = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/threads/${id}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load thread.");
      }

      const th = data.thread;
      setThread(th);
      setTitle(th.title || "");
      setTweets(th.tweets || []);
      setThreadStatus(th.status || "draft");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error loading thread.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThread();
  }, [id]);

  // Live validation calculations
  const validationErrors = validateThread({
    title,
    sourceUrl: thread?.source_url || "https://wikenigma.org",
    tweets: tweets.map((t, idx) => ({
      position: idx + 1,
      text: t.text,
    })),
  });

  const isValid = validationErrors.length === 0;

  const handleTweetChange = (index: number, text: string) => {
    const nextTweets = [...tweets];
    nextTweets[index] = { ...nextTweets[index], text };
    setTweets(nextTweets);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const nextTweets = [...tweets];
    const temp = nextTweets[index - 1];
    nextTweets[index - 1] = nextTweets[index];
    nextTweets[index] = temp;

    // re-index positions
    nextTweets.forEach((t, i) => (t.position = i + 1));
    setTweets(nextTweets);
  };

  const handleMoveDown = (index: number) => {
    if (index === tweets.length - 1) return;
    const nextTweets = [...tweets];
    const temp = nextTweets[index + 1];
    nextTweets[index + 1] = nextTweets[index];
    nextTweets[index] = temp;

    // re-index positions
    nextTweets.forEach((t, i) => (t.position = i + 1));
    setTweets(nextTweets);
  };

  const handleDeleteTweet = (index: number) => {
    if (tweets.length <= 1) {
      alert("A thread must contain at least 1 tweet card.");
      return;
    }
    const nextTweets = tweets.filter((_, idx) => idx !== index);
    nextTweets.forEach((t, i) => (t.position = i + 1));
    setTweets(nextTweets);
  };

  const handleAddTweet = () => {
    const nextTweets = [
      ...tweets,
      { position: tweets.length + 1, text: "" },
    ];
    setTweets(nextTweets);
  };

  const handleSave = async (newThreadStatus?: string) => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          tweets: tweets.map((t, idx) => ({ position: idx + 1, text: t.text })),
          // The thread's own review gate. The draft's status is a separate
          // gate and is deliberately not touched from here.
          status: newThreadStatus || threadStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save thread.");
      }

      if (newThreadStatus) {
        setThreadStatus(newThreadStatus);
      }

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
        "Are you sure you want to regenerate this thread sequence with OpenAI? Unsaved edits will be replaced."
      )
    ) {
      return;
    }

    setRegenerating(true);
    try {
      const res = await fetch(`/api/threads/${id}/regenerate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Regeneration failed.");
      }
      await fetchThread();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Regeneration failed.");
    } finally {
      setRegenerating(false);
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

  if (!thread) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/threads"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Threads
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          Thread not found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/80 pb-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/threads"
            className="p-1.5 rounded-lg border border-zinc-200/80 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge status={threadStatus} />
              <span className="text-xs text-zinc-500 font-medium">
                Thread Studio
              </span>
            </div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-0.5">
              Thread Editor
            </h1>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`}
            />
            Regenerate Thread
          </button>

          <button
            onClick={() => handleSave("rejected")}
            disabled={saving || threadStatus === "rejected"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            <XCircle className="h-3.5 w-3.5" /> Reject
          </button>

          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-900 shadow-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : saveSuccess ? "Saved!" : "Save"}
          </button>

          <button
            onClick={() => handleSave("approved")}
            disabled={saving || !isValid || threadStatus === "approved"}
            title={
              !isValid
                ? "Cannot approve thread with validation errors."
                : "Approve thread"
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Approve Thread
          </button>
        </div>
      </div>

      {/* Validation Banner */}
      {!isValid ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-900/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Validation Issues Detected ({validationErrors.length})
          </div>
          <ul className="list-disc list-inside text-xs space-y-1 pl-1">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 pt-1">
            Resolve validation errors before approving this thread.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Thread satisfies length (5–7 tweets) and character limits (≤280 chars). Ready for approval!</span>
          </div>
        </div>
      )}

      {/* Editable Title Card */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
            Thread Title
          </label>
          <a
            href={thread.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Source article <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3.5 py-2 text-sm font-bold text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      {/* Tweet Cards List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            Tweet Sequence ({tweets.length})
          </h2>
          <button
            onClick={handleAddTweet}
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add Tweet Card
          </button>
        </div>

        {tweets.map((tweet, idx) => {
          const charCount = tweet.text.length;
          const isOver = charCount > 280;
          const isEmpty = !tweet.text.trim();

          return (
            <div
              key={idx}
              className={`rounded-xl border bg-white p-5 transition-all dark:bg-zinc-900 shadow-xs space-y-3 ${
                isOver || isEmpty
                  ? "border-amber-300 dark:border-amber-800/80"
                  : "border-zinc-200/90 dark:border-zinc-800"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-medium text-zinc-400">
                    of {tweets.length}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Character Count Badge */}
                  <span
                    className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded ${
                      isOver
                        ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/50"
                        : charCount > 260
                        ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/50"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {charCount} / 280
                  </span>

                  {/* Reordering Controls */}
                  <div className="flex items-center border border-zinc-200 rounded-lg dark:border-zinc-800 overflow-hidden">
                    <button
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="p-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      title="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
                    <button
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === tweets.length - 1}
                      className="p-1 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      title="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleDeleteTweet(idx)}
                    className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400"
                    title="Delete tweet"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                rows={3}
                value={tweet.text}
                onChange={(e) => handleTweetChange(idx, e.target.value)}
                placeholder={`Tweet ${idx + 1} content...`}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 text-sm text-zinc-900 placeholder-zinc-400 leading-relaxed focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
          );
        })}

        <div className="pt-2 text-center">
          <button
            onClick={handleAddTweet}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-4 py-2.5 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:bg-white dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 transition-all w-full justify-center"
          >
            <Plus className="h-4 w-4" /> Add Tweet Card
          </button>
        </div>
      </div>
    </div>
  );
}
