import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "d_CuriousMind | Editorial Dashboard",
  description: "Internal editorial workspace and automated curiosity pipeline for d_CuriousMind.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
