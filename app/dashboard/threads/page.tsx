"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Search,
  ChevronRight,
  ExternalLink,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/loading-skeleton";
import { validateThread } from "@/lib/thread/validate";

interface ThreadItem {
  id: string;
  draft_id: string;
  title: string;
  source_url: string;
  created_at: string;
  updated_at: string;
  thread_tweets?: { id: string; position: number; text: string }[];
  status?: string;
  drafts?: { id: string; status: string; question: string };
}

export default function ThreadsPage() {
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function loadThreads() {
      setLoading(true);
      try {
        const res = await fetch("/api/threads/list");
        if (res.ok) {
          const data = await res.json();
          if (data.threads) {
            setThreads(data.threads);
          }
        }
      } catch (err) {
        console.error("Failed to load threads:", err);
      } finally {
        setLoading(false);
      }
    }
    loadThreads();
  }, []);

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      const draftQuestion = t.drafts?.question || "";
      const matchSearch =
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        draftQuestion.toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      if (statusFilter === "all") return true;
      // Filter on the thread's own review status, not the draft's.
      const threadStatus = t.status || "draft";
      return threadStatus.toLowerCase() === statusFilter.toLowerCase();
    });
  }, [threads, search, statusFilter]);

  const filterTabs = [
    { id: "all", label: "All" },
    { id: "draft", label: "Pending Review" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Thread Studio
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            X thread sequences created from approved curiosity explanations.
          </p>
        </div>

        <Link
          href="/dashboard/drafts"
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-xs"
        >
          <Sparkles className="h-3.5 w-3.5" /> Select Draft to Generate Thread
        </Link>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search thread title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200/90 bg-white pl-9 pr-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 max-w-full">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                statusFilter === tab.id
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-xl border border-zinc-200/80 bg-white p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-900">
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
      ) : filteredThreads.length === 0 ? (
        <EmptyState
          title="No threads have been generated yet"
          description="Select an approved draft in the Draft Workspace to generate an editorial X thread."
          icon={<MessageSquare className="h-6 w-6" />}
          action={
            <Link
              href="/dashboard/drafts"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              View Drafts <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredThreads.map((thread) => {
            const tweets = thread.thread_tweets || [];
            const validationErrors = validateThread({
              title: thread.title,
              sourceUrl: thread.source_url,
              tweets: tweets.map((t) => ({ position: t.position, text: t.text })),
            });

            const isValid = validationErrors.length === 0;
            const threadStatus = thread.status || "draft";

            return (
              <div
                key={thread.id}
                className="flex flex-col justify-between rounded-xl border border-zinc-200/90 bg-white p-5 hover:border-zinc-300 transition-all dark:border-zinc-800 dark:bg-zinc-900/90 dark:hover:border-zinc-700 shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge status={threadStatus} />
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                        isValid
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40"
                      }`}
                    >
                      {isValid ? "Valid Thread" : `${validationErrors.length} Issue(s)`}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      {thread.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>{tweets.length} Tweets</span>
                      <span>•</span>
                      <a
                        href={thread.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:underline text-indigo-600 dark:text-indigo-400"
                      >
                        Source Link <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <span className="text-[11px] text-zinc-400">
                    Updated {new Date(thread.updated_at).toLocaleDateString()}
                  </span>

                  <Link
                    href={`/dashboard/threads/${thread.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                  >
                    Edit Thread <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
