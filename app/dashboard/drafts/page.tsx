"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  ChevronRight,
  Sparkles,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/loading-skeleton";

interface DraftItem {
  id: string;
  article_id: string;
  status: string;
  question: string;
  explanation: string;
  interesting_detail: string | null;
  takeaway: string | null;
  updated_at: string;
  articles?: {
    id: string;
    title: string;
    url: string;
    topic_scores?: { overall: number }[];
  };
  threads?: { id: string }[];
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function loadDrafts() {
      setLoading(true);
      try {
        const res = await fetch("/api/drafts/list");
        if (res.ok) {
          const data = await res.json();
          if (data.drafts) {
            setDrafts(data.drafts);
          }
        }
      } catch (err) {
        console.error("Failed to load drafts:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDrafts();
  }, []);

  const filteredDrafts = useMemo(() => {
    return drafts.filter((d) => {
      const articleTitle = d.articles?.title || "";
      const matchSearch =
        d.question.toLowerCase().includes(search.toLowerCase()) ||
        articleTitle.toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;
      if (statusFilter === "all") return true;
      return d.status.toLowerCase() === statusFilter.toLowerCase();
    });
  }, [drafts, search, statusFilter]);

  const filterTabs = [
    { id: "all", label: "All" },
    { id: "draft", label: "Awaiting Review" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
    { id: "scheduled", label: "Scheduled" },
    { id: "published", label: "Published" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Draft Workspace
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Curiosity explanation drafts rewritten for d_CuriousMind style.
          </p>
        </div>

        <Link
          href="/dashboard/topics"
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors shadow-xs"
        >
          <Sparkles className="h-3.5 w-3.5" /> Select Topics to Rewrite
        </Link>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search questions or source topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200/90 bg-white pl-9 pr-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>

        {/* Status filter tabs */}
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

      {/* List or Grid */}
      {loading ? (
        <div className="rounded-xl border border-zinc-200/80 bg-white p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-900">
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
      ) : filteredDrafts.length === 0 ? (
        <EmptyState
          title="No drafts waiting for review"
          description="There are currently no generated drafts matching your selected filter."
          icon={<FileText className="h-6 w-6" />}
          action={
            <Link
              href="/dashboard/topics"
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Explore Topics <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDrafts.map((draft) => {
            const articleTitle = draft.articles?.title || "Untitled Topic";
            const threadObj = Array.isArray(draft.threads)
              ? draft.threads[0]
              : draft.threads;

            return (
              <div
                key={draft.id}
                className="flex flex-col justify-between rounded-xl border border-zinc-200/90 bg-white p-5 hover:border-zinc-300 transition-all dark:border-zinc-800 dark:bg-zinc-900/90 dark:hover:border-zinc-700 shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge status={draft.status} />
                    <span className="text-[11px] text-zinc-400">
                      Updated {new Date(draft.updated_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Source Topic: {articleTitle}
                    </span>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                      {draft.question}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                      {draft.explanation}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  {threadObj?.id ? (
                    <Link
                      href={`/dashboard/threads/${threadObj.id}`}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400 font-medium"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> View Thread →
                    </Link>
                  ) : (
                    <span className="text-xs text-zinc-400">No thread yet</span>
                  )}

                  <Link
                    href={`/dashboard/drafts/${draft.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                  >
                    Edit Draft <ChevronRight className="h-3.5 w-3.5" />
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
