import React from 'react';
import { useUser } from './UserContext';

export function RoleSelector() {
  const { currentUser, switchUser, availableUsers } = useUser();

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2 style={{ marginBottom: 16 }}>사용자 선택</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {availableUsers.map((user) => {
          const isActive = currentUser?.id === user.id;
          return (
            <button
              key={user.id}
              onClick={() => switchUser(user.id)}
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                border: isActive ? '2px solid #2563eb' : '1px solid #d1d5db',
                background: isActive ? '#eff6ff' : '#ffffff',
                cursor: 'pointer',
                minWidth: 180,
                textAlign: 'left',
                boxShadow: isActive ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : 'none',
              }}
            >
              <strong style={{ display: 'block', fontSize: 16 }}>{user.name}</strong>
              <span style={{ fontSize: 13, color: '#4b5563' }}>{user.role.toUpperCase()}</span>
              <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#6b7280' }}>{user.email}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
