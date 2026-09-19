import React from "react";

export type StatusType =
  | "discovered"
  | "filtered"
  | "selected"
  | "extracted"
  | "rejected"
  | "processed"
  | "scored"
  | "draft"
  | "approved"
  | "scheduled"
  | "published"
  | "generated"
  | string;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const normalized = (status || "").toLowerCase();

  const getStyle = (st: string) => {
    switch (st) {
      case "approved":
      case "published":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40";
      case "selected":
      case "extracted":
        return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40";
      case "processed":
      case "generated":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/40";
      case "draft":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40";
      case "scheduled":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40";
      case "rejected":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40";
      case "discovered":
      case "filtered":
      case "scored":
      default:
        return "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-300 dark:border-zinc-700/60";
    }
  };

  const formattedLabel =
    normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${getStyle(
        normalized
      )} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          normalized === "approved" || normalized === "published"
            ? "bg-emerald-500"
            : normalized === "selected" || normalized === "extracted"
            ? "bg-sky-500"
            : normalized === "draft"
            ? "bg-amber-500"
            : normalized === "rejected"
            ? "bg-rose-500"
            : "bg-zinc-400"
        }`}
      />
      {formattedLabel}
    </span>
  );
}
