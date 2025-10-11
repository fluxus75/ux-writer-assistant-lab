import React from 'react';
import type { Draft } from '../lib/types';

export function useDrafts(initialDrafts: Draft[] = []) {
  const [drafts, setDrafts] = React.useState<Draft[]>(initialDrafts);

  const addDraft = React.useCallback((draft: Draft) => {
    setDrafts((prev) => [draft, ...prev]);
  }, []);

  const resetDrafts = React.useCallback((nextDrafts: Draft[]) => {
    setDrafts(nextDrafts);
  }, []);

  return { drafts, addDraft, resetDrafts };
}
