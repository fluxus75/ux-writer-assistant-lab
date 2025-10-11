import React from 'react';
import type { RequestSummary } from '../lib/types';
import { StatusBadge } from './StatusBadge';

interface RequestCardProps {
  request: RequestSummary;
  onClick?: () => void;
  showDraftButton?: boolean;
}

export function RequestCard({ request, onClick, showDraftButton }: RequestCardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: onClick ? 'pointer' : 'default',
        background: '#ffffff',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>{request.title}</h3>
        <StatusBadge status={request.status} />
      </div>
      <p style={{ margin: 0, color: '#4b5563' }}>기능: {request.feature_name}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280' }}>
        <span>드래프트 수: {request.draft_count}</span>
        {request.assigned_writer_id ? <span>담당 라이터: {request.assigned_writer_id}</span> : <span>담당 라이터 미정</span>}
      </div>
      {showDraftButton && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClick?.();
          }}
          style={{
            alignSelf: 'flex-start',
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid #2563eb',
            background: '#2563eb',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          작업하기
        </button>
      )}
    </div>
  );
}
