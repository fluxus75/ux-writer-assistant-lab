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

  const setDraftSelection = React.useCallback((draftId: string, versionId: string | null) => {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.id === draftId
          ? {
              ...draft,
              selected_version_id: versionId,
            }
          : draft,
      ),
    );
  }, []);

  return { drafts, addDraft, resetDrafts, setDraftSelection };
}
