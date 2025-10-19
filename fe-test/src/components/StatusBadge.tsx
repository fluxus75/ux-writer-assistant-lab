import React from 'react';
import type { RequestStatus } from '../lib/types';

const STATUS_META: Record<RequestStatus, { label: string; classes: string }> = {
  drafting: { label: '작성 요청', classes: 'bg-blue-50 text-blue-700' },
  in_review: { label: '디자이너 리뷰요청', classes: 'bg-yellow-50 text-yellow-700' },
  approved: { label: '승인완료', classes: 'bg-green-50 text-green-700' },
  rejected: { label: '반려됨', classes: 'bg-red-50 text-red-700' },
  needs_revision: { label: '재작성 요청', classes: 'bg-orange-50 text-orange-700' },
  cancelled: { label: '요청 취소', classes: 'bg-gray-50 text-gray-700' },
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
