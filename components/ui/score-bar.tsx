import React from "react";

interface ScoreBarProps {
  label: string;
  score: number;
  maxScore?: number;
  description?: string;
  showValue?: boolean;
}

export function ScoreBar({
  label,
  score,
  maxScore = 10,
  description,
  showValue = true,
}: ScoreBarProps) {
  const percentage = Math.min(Math.max((score / maxScore) * 100, 0), 100);

  const getScoreColor = (val: number) => {
    if (val >= 8) return "bg-emerald-500 text-emerald-700 dark:text-emerald-400";
    if (val >= 6) return "bg-amber-500 text-amber-700 dark:text-amber-400";
    return "bg-zinc-400 text-zinc-600 dark:text-zinc-400";
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          {label}
        </span>
        {showValue && (
          <span className={`font-semibold tabular-nums ${getScoreColor(score).split(" ")[1]}`}>
            {score.toFixed(1)} <span className="text-zinc-400 font-normal text-xs">/ {maxScore}</span>
          </span>
        )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            getScoreColor(score).split(" ")[0]
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {description && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      )}
    </div>
  );
}
