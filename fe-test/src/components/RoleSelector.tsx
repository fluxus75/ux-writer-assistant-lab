import React from 'react';
import { useUser } from './UserContext';

export function RoleSelector() {
  const { currentUser, switchUser, availableUsers } = useUser();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Choose a workspace persona</h2>
        <p className="mt-1 text-sm text-slate-600">Switch between designer, writer, and admin roles to demo the flow.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {availableUsers.map((user) => {
          const isActive = currentUser?.id === user.id;
          return (
            <button
              key={user.id}
              onClick={() => switchUser(user.id)}
              className={`flex h-full flex-col items-start gap-2 rounded-lg border px-4 py-5 text-left transition-shadow ${
                isActive
                  ? 'border-primary-600 bg-primary-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:shadow-md'
              }`}
            >
              <strong className="text-base font-semibold text-slate-900">{user.name}</strong>
              <span className="text-xs font-semibold uppercase tracking-wide text-primary-600">{user.role}</span>
              <span className="text-sm text-slate-500">{user.email}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
