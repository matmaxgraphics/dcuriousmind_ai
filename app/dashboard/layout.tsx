import React from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { BottomNav } from "@/components/dashboard/bottom-nav";
import { Header } from "@/components/dashboard/header";
import { hasValidSession } from "@/lib/auth/session";

// Reading the session cookie makes every dashboard route dynamic, which is
// what we want: none of this should ever be prerendered or cached.

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await hasValidSession())) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950 font-sans antialiased text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0 pb-20 md:pb-8">
        <Header />
        <main className="flex-1 px-4 py-6 sm:px-6 md:px-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Native Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
}
