"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  ArrowUpDown,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableRowSkeleton } from "@/components/ui/loading-skeleton";

interface Topic {
  id: string;
  title: string;
  url: string;
  excerpt: string | null;
  status: string;
  discovered_at: string;
  sources?: { name: string };
  topic_scores?: { overall: number; reason: string }[];
  drafts?: { id: string; status: string }[];
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"score" | "date" | "title">("score");
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      // Fetch articles with score and draft references
      const res = await fetch("/api/dashboard/stats");
      const data = await res.json();
      if (data.success && data.queue) {
        // Also fetch full articles list via client supabase query or dedicated endpoint
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch("/api/topics/list");
        if (res.ok) {
          const data = await res.json();
          if (data.topics) {
            setTopics(data.topics);
          }
        }
      } catch (err) {
        console.error("Failed to load topics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleGenerateDraft = async (topicId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setGeneratingId(topicId);
    try {
      const res = await fetch(`/api/topics/${topicId}/generate-draft`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate draft.");
      }
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Draft generation failed.");
    } finally {
      setGeneratingId(null);
    }
  };

  const filteredTopics = useMemo(() => {
    return topics
      .filter((t) => {
        const matchSearch =
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          (t.excerpt && t.excerpt.toLowerCase().includes(search.toLowerCase()));

        if (!matchSearch) return false;

        if (statusFilter === "all") return true;
        return t.status.toLowerCase() === statusFilter.toLowerCase();
      })
      .sort((a, b) => {
        if (sortBy === "score") {
          const scoreA = a.topic_scores?.[0]?.overall ?? 0;
          const scoreB = b.topic_scores?.[0]?.overall ?? 0;
          return scoreB - scoreA;
        }
        if (sortBy === "date") {
          return (
            new Date(b.discovered_at).getTime() -
            new Date(a.discovered_at).getTime()
          );
        }
        return a.title.localeCompare(b.title);
      });
  }, [topics, search, statusFilter, sortBy]);

  const filterTabs = [
    { id: "all", label: "All" },
    { id: "selected", label: "Selected" },
    { id: "extracted", label: "Extracted" },
    { id: "processed", label: "Processed" },
    { id: "rejected", label: "Rejected" },
    { id: "discovered", label: "Discovered" },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Topic Repository
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Curated questions discovered from Wikenigma RSS feeds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setLoading(true);
              await fetch("/api/discover");
              window.location.reload();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Run Discovery
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search topics or excerpts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200/90 bg-white pl-9 pr-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>

        {/* Sort selector & status tabs */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 max-w-full">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  statusFilter === tab.id
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "score" | "date" | "title")}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 focus:outline-none"
            >
              <option value="score">Sort by Score</option>
              <option value="date">Sort by Date</option>
              <option value="title">Sort by Title</option>
            </select>
          </div>
        </div>
      </div>

      {/* Topics List Table */}
      {loading ? (
        <div className="rounded-xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-2 divide-y divide-zinc-100 dark:divide-zinc-800">
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
      ) : filteredTopics.length === 0 ? (
        <EmptyState
          title="No topics match your filter"
          description="Try adjusting your search terms or filter criteria, or run discovery to pull new Wikenigma articles."
          action={
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
              className="text-xs font-medium text-zinc-800 underline dark:text-zinc-200"
            >
              Reset filters
            </button>
          }
        />
      ) : (
        <div className="rounded-xl border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200/80 bg-zinc-50/50 text-xs font-medium uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Topic Title</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">AI Score</th>
                  <th className="px-4 py-3">Discovered</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {filteredTopics.map((topic) => {
                  const scoreObj = topic.topic_scores?.[0];
                  const draftObj = topic.drafts?.[0];
                  const sourceName = topic.sources?.name || "Wikenigma";

                  return (
                    <tr
                      key={topic.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-850/50 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-medium text-zinc-900 dark:text-zinc-100 max-w-xs md:max-w-md">
                        <Link
                          href={`/dashboard/topics/${topic.id}`}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <span className="truncate">{topic.title}</span>
                        </Link>
                        {topic.excerpt && (
                          <p className="text-xs font-normal text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                            {topic.excerpt}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {sourceName}
                          <a
                            href={topic.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge status={topic.status} />
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {scoreObj?.overall !== undefined ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/40">
                            {scoreObj.overall.toFixed(1)} / 10
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400 font-normal">Unscored</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {new Date(topic.discovered_at).toLocaleDateString()}
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {draftObj?.id ? (
                            <Link
                              href={`/dashboard/drafts/${draftObj.id}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                              View Draft <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          ) : (
                            <button
                              onClick={(e) => handleGenerateDraft(topic.id, e)}
                              disabled={generatingId === topic.id}
                              className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                            >
                              {generatingId === topic.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Zap className="h-3 w-3" />
                              )}
                              Generate Draft
                            </button>
                          )}

                          <Link
                            href={`/dashboard/topics/${topic.id}`}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                            title="View topic detail"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
