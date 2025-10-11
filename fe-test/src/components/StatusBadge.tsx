import React from 'react';
import type { RequestStatus } from '../lib/types';

const STATUS_LABELS: Record<RequestStatus, string> = {
  drafting: '작성중',
  in_review: '검토중',
  approved: '승인됨',
  rejected: '거절됨',
};

const STATUS_COLORS: Record<RequestStatus, { bg: string; text: string }> = {
  drafting: { bg: '#e0f2fe', text: '#0369a1' },
  in_review: { bg: '#fef3c7', text: '#b45309' },
  approved: { bg: '#dcfce7', text: '#15803d' },
  rejected: { bg: '#fee2e2', text: '#b91c1c' },
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const color = STATUS_COLORS[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 999,
        padding: '4px 10px',
        background: color.bg,
        color: color.text,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
