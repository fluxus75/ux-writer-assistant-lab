import React from 'react';
import type { RequestSummary } from '../lib/types';
import { StatusBadge } from './StatusBadge';

interface RequestCardProps {
  request: RequestSummary;
  onClick?: () => void;
  showDraftButton?: boolean;
}

export function RequestCard({ request, onClick, showDraftButton }: RequestCardProps) {
  const assignedLabel = request.assigned_writer_id ? `할당됨: ${request.assigned_writer_id}` : '작가 미할당';

  return (
    <div
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{request.title}</h3>
          <p className="mt-1 text-sm text-slate-600">기능: {request.feature_name}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
        <span>드래프트: {request.draft_count}</span>
        <span>{assignedLabel}</span>
      </div>

      {showDraftButton && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClick?.();
          }}
          className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary-500"
        >
          작업공간 열기
        </button>
      )}
    </div>
  );
}
