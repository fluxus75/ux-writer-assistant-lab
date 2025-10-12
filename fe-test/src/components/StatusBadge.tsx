import React from 'react';
import type { RequestStatus } from '../lib/types';

const STATUS_META: Record<RequestStatus, { label: string; classes: string }> = {
  drafting: { label: '작성중', classes: 'bg-blue-50 text-blue-700' },
  in_review: { label: '검토중', classes: 'bg-yellow-50 text-yellow-700' },
  approved: { label: '승인됨', classes: 'bg-green-50 text-green-700' },
  rejected: { label: '반려됨', classes: 'bg-red-50 text-red-700' },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${meta.classes}`}
    >
      {meta.label}
    </span>
  );
}
