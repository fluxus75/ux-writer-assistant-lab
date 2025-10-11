import React from 'react';
import { useUser } from './UserContext';

export function UserSwitcher() {
  const { currentUser, switchUser, availableUsers } = useUser();

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
      <span style={{ color: '#6b7280' }}>사용자:</span>
      <select
        value={currentUser?.id ?? ''}
        onChange={(event) => switchUser(event.target.value)}
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
      >
        <option value="" disabled>
          역할 선택
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
