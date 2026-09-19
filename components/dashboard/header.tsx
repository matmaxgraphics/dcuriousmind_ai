"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, RefreshCw, Play, LogOut } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  const getPageTitle = (path: string) => {
    if (path === "/dashboard") return "Editorial Overview";
    if (path.startsWith("/dashboard/topics")) return "Topic Discovery & Selection";
    if (path.startsWith("/dashboard/drafts")) return "Draft Workspace";
    if (path.startsWith("/dashboard/threads")) return "Thread Studio";
    if (path.startsWith("/dashboard/settings")) return "Pipeline Settings";
    return "Editorial Dashboard";
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  const handleRunPipelineStep = async (step: "discover" | "score") => {
    setIsTriggering(true);
    setTriggerMessage(`Running ${step}...`);

    try {
      const res = await fetch(`/api/${step}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `${step} failed.`);
      }

      setTriggerMessage(`Success! Updated ${data.discovered ?? data.scored ?? 0} items.`);
      setTimeout(() => {
        setTriggerMessage(null);
        window.location.reload();
      }, 1500);
    } catch (err) {
      setTriggerMessage(`Error: ${err instanceof Error ? err.message : "Failed"}`);
      setTimeout(() => setTriggerMessage(null), 3000);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80 px-4 py-3.5 sm:px-6 md:px-8">
      <div className="flex items-center justify-between">
        {/* Title / Mobile Brand Header */}
        <div className="flex items-center gap-3">
          <div className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              d_CuriousMind
            </p>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {getPageTitle(pathname)}
            </h2>
          </div>
        </div>

        {/* Quick Action Trigger Buttons */}
        <div className="flex items-center gap-2">
          {triggerMessage && (
            <span className="hidden sm:inline-block text-xs font-medium text-zinc-600 dark:text-zinc-400 animate-pulse px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800">
              {triggerMessage}
            </span>
          )}

          <button
            onClick={() => handleRunPipelineStep("discover")}
            disabled={isTriggering}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
            title="Discover articles from Wikenigma RSS"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isTriggering ? "animate-spin text-indigo-500" : ""}`}
            />
            <span className="hidden sm:inline">Run Discovery</span>
          </button>

          <button
            onClick={() => handleRunPipelineStep("score")}
            disabled={isTriggering}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
            title="Run AI topic scoring on discovered articles"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span className="hidden sm:inline">Score Topics</span>
          </button>

          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-xs hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="sr-only">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
