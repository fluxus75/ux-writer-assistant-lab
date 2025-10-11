import React from 'react';
import { RequestCard } from '../components/RequestCard';
import { UserSwitcher } from '../components/UserSwitcher';
import { useUser } from '../components/UserContext';
import { useRequests } from '../hooks/useRequests';
import type { RequestStatus } from '../lib/types';

const FILTER_LABELS: { value: RequestStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'drafting', label: '작성중' },
  { value: 'in_review', label: '검토중' },
  { value: 'approved', label: '승인됨' },
  { value: 'rejected', label: '거절됨' },
];

export function DesignerDashboard() {
  const { requests, loading, error, refresh } = useRequests();
  const { currentUser } = useUser();
  const [filter, setFilter] = React.useState<RequestStatus | 'all'>('all');

  const filteredRequests = React.useMemo(() => {
    if (filter === 'all') {
      return requests;
    }
    return requests.filter((request) => request.status === filter);
  }, [filter, requests]);

  if (!currentUser) {
    return null;
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 960, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Designer Dashboard</h1>
          <p style={{ marginTop: 8, color: '#6b7280' }}>{currentUser.name}님 환영합니다.</p>
        </div>
        <UserSwitcher />
      </header>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => {
            window.location.hash = 'create-request';
          }}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #2563eb',
            background: '#2563eb',
            color: '#ffffff',
            fontWeight: 600,
          }}
        >
          새 요청 생성
        </button>
        <button
          type="button"
          onClick={() => {
            void refresh();
          }}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            background: '#ffffff',
            color: '#2563eb',
            fontWeight: 600,
          }}
        >
          새로고침
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 14, color: '#4b5563', marginRight: 8 }}>상태 필터</label>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as RequestStatus | 'all')}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db' }}
        >
          {FILTER_LABELS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <p>요청 목록을 불러오는 중...</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

      <div style={{ display: 'grid', gap: 16 }}>
        {filteredRequests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            onClick={() => {
              window.location.hash = `request/${request.id}`;
            }}
          />
        ))}
        {!loading && filteredRequests.length === 0 && <p style={{ color: '#6b7280' }}>표시할 요청이 없습니다.</p>}
      </div>
    </div>
  );
}
