"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "classnames";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RoleProvider, useRole } from "./role-context";

const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/requests", label: "Requests" },
  { href: "/workspace", label: "Workspace" },
  { href: "/exports", label: "Exports" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <RoleProvider>
      <QueryClientProvider client={queryClient}>
        <AppShellInner>{children}</AppShellInner>
      </QueryClientProvider>
    </RoleProvider>
  );
}

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role, userId, toggleRole } = useRole();

  const roleDisplay = useMemo(() => {
    if (!role) {
      return "Unknown";
    }
    return `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
  }, [role]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-primary-100 px-3 py-1 text-sm font-semibold text-primary-600">
              UX Writer Assistant
            </span>
            <span className="text-sm text-slate-500">Day 3 workspace shell</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
              {roleDisplay} · {userId}
            </span>
            <button
              type="button"
              onClick={toggleRole}
              className="rounded-md border border-slate-200 px-3 py-1 text-slate-600 transition-colors hover:bg-slate-100"
            >
              Switch Role
            </button>
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-56 border-r bg-white/90 lg:block">
          <nav className="sticky top-20 flex flex-col gap-1 px-4 py-6">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-50 text-primary-600"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 bg-slate-50/60 px-6 py-8">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
