"use client";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col md:pl-[248px]">
        <Topbar />
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-7 sm:px-8">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-[1200px] px-5 pb-8 pt-4 text-xs text-muted sm:px-8">
          Frontend consumes the FastAPI backend only — no direct Cognee or database
          access. Seeded demo data is shown while the backend is offline.
        </footer>
      </div>
    </div>
  );
}
