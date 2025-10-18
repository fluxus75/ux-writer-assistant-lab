import React from 'react';
import type { Draft, DraftVersion } from '../lib/types';

interface DraftListProps {
  drafts: Draft[];
  canSelect?: boolean;
  onOpenSelectionModal?: (draftId: string, version: DraftVersion) => void;
  onClearSelection?: (draftId: string) => void;
}

export function DraftList({ drafts, canSelect = false, onOpenSelectionModal, onClearSelection }: DraftListProps) {
  if (drafts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
        아직 생성된 드래프트가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {drafts.map((draft) => {
        const selectedVersion = draft.selected_version_id
          ? draft.versions.find((version) => version.id === draft.selected_version_id)
          : undefined;

        return (
          <div key={draft.id} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-semibold text-slate-900">생성자: {draft.created_by}</span>
              <span className="text-xs text-slate-500">{new Date(draft.created_at).toLocaleString()}</span>
            </div>

            {selectedVersion && (
              <div className="flex flex-wrap items-center justify-between rounded-md bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
                <span>선택된 버전: {selectedVersion.version_index}</span>
                {canSelect && onClearSelection && (
                  <button
                    type="button"
                    onClick={() => onClearSelection(draft.id)}
                    className="text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline"
                  >
                    선택 해제
                  </button>
                )}
              </div>
            )}

            <div className="space-y-3">
              {draft.versions.map((version) => (
                <article
                  key={version.id}
                  className={`space-y-3 rounded-lg border px-4 py-3 ${
                    draft.selected_version_id === version.id
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <header className="flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                    <span>버전 {version.version_index}</span>
                    <span>{new Date(version.created_at).toLocaleString()}</span>
                  </header>
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{version.content}</pre>
                  {canSelect && (
                    <div>
                      <button
                        type="button"
                        onClick={() => onOpenSelectionModal?.(draft.id, version)}
                        disabled={draft.selected_version_id === version.id}
                        className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                          draft.selected_version_id === version.id
                            ? 'cursor-default border border-emerald-600 bg-white text-emerald-700'
                            : 'border border-primary-600 bg-primary-600 text-white hover:bg-primary-500'
                        }`}
                      >
                        {draft.selected_version_id === version.id ? '선택됨' : '이 버전 사용'}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
