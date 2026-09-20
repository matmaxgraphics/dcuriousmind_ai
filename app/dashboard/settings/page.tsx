"use client";

import React, { useState } from "react";
import {
  Settings,
  Database,
  Cpu,
  Rss,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
} from "lucide-react";

export default function SettingsPage() {
  const [runningStep, setRunningStep] = useState<string | null>(null);
  const [stepLogs, setStepLogs] = useState<
    { step: string; success: boolean; message: string; timestamp: string }[]
  >([]);

  const runStep = async (endpoint: string, label: string) => {
    setRunningStep(label);
    try {
      const res = await fetch(`/api/${endpoint}`);
      const data = await res.json();

      const logEntry = {
        step: label,
        success: res.ok && data.success !== false,
        message: data.message
          ? data.message
          : data.discovered !== undefined
          ? `Discovered ${data.discovered} topics (${data.saved ?? 0} saved)`
          : data.scored !== undefined
          ? `Scored ${data.scored} topics`
          : data.extracted !== undefined
          ? `Extracted ${data.extracted} articles`
          : data.rewritten !== undefined
          ? `Rewrote ${data.rewritten} drafts`
          : data.generated !== undefined
          ? `Generated ${data.generated} threads`
          : JSON.stringify(data),
        timestamp: new Date().toLocaleTimeString(),
      };

      setStepLogs((prev) => [logEntry, ...prev]);
    } catch (err) {
      setStepLogs((prev) => [
        {
          step: label,
          success: false,
          message: err instanceof Error ? err.message : "Pipeline step failed",
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } finally {
      setRunningStep(null);
    }
  };

  const steps = [
    {
      label: "1. Discover RSS Articles",
      endpoint: "discover",
      description: "Generates grounded questions and pulls new entries from every active source.",
    },
    {
      label: "2. AI Topic Scoring",
      endpoint: "score",
      description: "Evaluates discovered articles for curiosity gap, surprise, and relevance.",
    },
    {
      label: "3. Extract Selected Articles",
      endpoint: "extract-selected",
      description: "Fetches full content for selected topics. Capped per run.",
    },
    {
      label: "4. Rewrite into Drafts",
      endpoint: "rewrite-selected",
      description: "Writes drafts, then fact-checks and quality-checks each one. Capped per run.",
    },
    {
      label: "5. Generate X Threads",
      endpoint: "thread-selected",
      description: "Converts APPROVED drafts into 5-7 tweet threads. Approve a draft first, or this does nothing.",
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Pipeline Settings & Diagnostics
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Inspect backend connections and trigger pipeline steps.
        </p>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Source Status */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Content Source
            </span>
            <Rss className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Content sources
          </p>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Active Feed Enabled
          </div>
        </div>

        {/* Database Status */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Database
            </span>
            <Database className="h-4 w-4 text-sky-500" />
          </div>
          <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Supabase Cloud
          </p>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Connected & Syncing
          </div>
        </div>

        {/* AI Integration */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              AI Engine
            </span>
            <Cpu className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            OpenAI / Groq API
          </p>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Model Ready
          </div>
        </div>
      </div>

      {/* Manual Pipeline Batch Execution */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-6">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-500" /> Pipeline Operations Runner
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Execute batch pipeline stages manually or test specific automated sub-tasks.
          </p>
        </div>

        <div className="space-y-3 divide-y divide-zinc-100 dark:divide-zinc-800">
          {steps.map((step) => (
            <div
              key={step.endpoint}
              className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {step.label}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {step.description}
                </p>
              </div>

              <button
                onClick={() => runStep(step.endpoint, step.label)}
                disabled={runningStep !== null}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors shrink-0"
              >
                {runningStep === step.label ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
                Run Step
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Execution Log Output */}
      {stepLogs.length > 0 && (
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
            Execution Activity Log
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {stepLogs.map((log, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                  log.success
                    ? "bg-emerald-50/50 border-emerald-200/60 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-200"
                    : "bg-red-50/50 border-red-200/60 text-red-900 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-200"
                }`}
              >
                {log.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>{log.step}</span>
                    <span className="text-[10px] text-zinc-400 font-normal">
                      {log.timestamp}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] opacity-90">
                    {log.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
