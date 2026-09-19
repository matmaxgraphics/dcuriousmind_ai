"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Compass,
  FileText,
  MessageSquare,
  Settings,
  Sparkles,
  Database,
  CheckCircle2,
} from "lucide-react";

export const navItems = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    name: "Topics",
    href: "/dashboard/topics",
    icon: Compass,
  },
  {
    name: "Drafts",
    href: "/dashboard/drafts",
    icon: FileText,
  },
  {
    name: "Threads",
    href: "/dashboard/threads",
    icon: MessageSquare,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-zinc-200 bg-zinc-50/50 dark:bg-zinc-950 dark:border-zinc-800/80 z-30">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 shadow-xs">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            d_CuriousMind
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            Editorial Engine
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white text-zinc-950 shadow-xs border border-zinc-200/80 dark:bg-zinc-900 dark:text-zinc-50 dark:border-zinc-800"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/50 dark:hover:text-zinc-200"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${
                  isActive
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400 dark:text-zinc-500"
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-4 m-3 rounded-xl border border-zinc-200/80 bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              System Pipeline
            </span>
          </div>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Wikenigma & Supabase Active</span>
        </div>
      </div>
    </aside>
  );
}
