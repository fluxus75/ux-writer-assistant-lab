"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

type RoleIdentity = {
  role: string;
  userId: string;
};

type RoleContextValue = RoleIdentity & {
  toggleRole: () => void;
  setRole: (role: string, userId?: string) => void;
  setUserId: (userId: string) => void;
};

const DEFAULT_IDENTITIES: RoleIdentity[] = [
  { role: "designer", userId: "designer-1" },
  { role: "writer", userId: "writer-1" },
];

const FALLBACK_USER_BY_ROLE = DEFAULT_IDENTITIES.reduce<Record<string, string>>((acc, identity) => {
  acc[identity.role] = identity.userId;
  return acc;
}, {});

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

const resolveInitialIdentity = (): RoleIdentity => {
  const envRole = process.env.NEXT_PUBLIC_API_ROLE;
  const envUserId = process.env.NEXT_PUBLIC_API_USER_ID;
  if (envRole) {
    return {
      role: envRole,
      userId: envUserId ?? FALLBACK_USER_BY_ROLE[envRole] ?? `${envRole}-1`,
    };
  }
  return DEFAULT_IDENTITIES[0];
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<RoleIdentity>(() => resolveInitialIdentity());

  const toggleRole = useCallback(() => {
    setIdentity((current) => {
      const index = DEFAULT_IDENTITIES.findIndex((identityItem) => identityItem.role === current.role);
      if (index === -1) {
        return DEFAULT_IDENTITIES[0];
      }
      const nextIndex = (index + 1) % DEFAULT_IDENTITIES.length;
      return DEFAULT_IDENTITIES[nextIndex];
    });
  }, []);

  const setRole = useCallback((role: string, userId?: string) => {
    setIdentity((current) => ({
      role,
      userId: userId ?? (role === current.role ? current.userId : FALLBACK_USER_BY_ROLE[role] ?? `${role}-1`),
    }));
  }, []);

  const setUserId = useCallback((userId: string) => {
    setIdentity((current) => ({ ...current, userId }));
  }, []);

  const value = useMemo<RoleContextValue>(() => ({
    role: identity.role,
    userId: identity.userId,
    toggleRole,
    setRole,
    setUserId,
  }), [identity.role, identity.userId, setRole, setUserId, toggleRole]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
