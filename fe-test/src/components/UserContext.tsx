import React from 'react';
import type { User } from '../lib/types';
import { clearUser, loadUser, saveUser } from '../lib/userStorage';

interface UserContextValue {
  currentUser: User | null;
  switchUser: (userId: string) => void;
  availableUsers: User[];
  logout: () => void;
}

const MOCK_USERS: User[] = [
  { id: 'designer-1', role: 'designer', name: 'Alice Kim', email: 'alice@company.com' },
  { id: 'writer-1', role: 'writer', name: 'Bob Lee', email: 'bob@company.com' },
  { id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@company.com' },
];

const UserContext = React.createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = React.useState<User | null>(() => loadUser());

  const switchUser = React.useCallback((userId: string) => {
    const user = MOCK_USERS.find((candidate) => candidate.id === userId) ?? null;
    setCurrentUser(user);
    if (user) {
      saveUser(user);
    } else {
      clearUser();
    }
  }, []);

  const logout = React.useCallback(() => {
    setCurrentUser(null);
    clearUser();
  }, []);

  const value = React.useMemo(
    () => ({ currentUser, switchUser, availableUsers: MOCK_USERS, logout }),
    [currentUser, switchUser, logout],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = React.useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within UserProvider');
  }
  return ctx;
}
