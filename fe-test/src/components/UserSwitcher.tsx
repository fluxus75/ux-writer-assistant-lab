import React from 'react';
import { useUser } from './UserContext';

export function UserSwitcher() {
  const { currentUser, switchUser, availableUsers } = useUser();

  return (
    <label className="flex items-center gap-3 text-sm text-slate-500">
      <span className="font-medium">Persona</span>
      <select
        value={currentUser?.id ?? ''}
        onChange={(event) => switchUser(event.target.value)}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="" disabled>
          Select user
        </option>
        {availableUsers.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} · {user.role}
          </option>
        ))}
      </select>
    </label>
  );
}
