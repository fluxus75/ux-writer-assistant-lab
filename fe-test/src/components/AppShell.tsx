import React from 'react';
import { Navigation } from './Navigation';
import { UserSwitcher } from './UserSwitcher';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="fixed inset-x-0 top-0 z-10 h-16 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-full max-w-screen-2xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-primary-600">UX Writer Assistant</h1>
            <span className="text-sm text-slate-500">워크플로우 관리</span>
          </div>
          <UserSwitcher />
        </div>
      </header>

      <div className="flex min-h-screen pt-16">
        <aside className="fixed inset-y-16 left-0 w-56 border-r border-slate-200 bg-white">
          <Navigation />
        </aside>
        <main className="ml-56 flex-1 bg-slate-50 p-8">
          <div className="mx-auto max-w-screen-xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
