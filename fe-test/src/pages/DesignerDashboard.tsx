import React from 'react';
import { RequestCard } from '../components/RequestCard';
import { useUser } from '../components/UserContext';
import { useRequests } from '../hooks/useRequests';
import type { RequestStatus } from '../lib/types';

const FILTER_LABELS: { value: RequestStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'drafting', label: '작성중' },
  { value: 'in_review', label: '검토중' },
  { value: 'approved', label: '승인됨' },
  { value: 'rejected', label: '반려됨' },
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
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">디자이너 대시보드</h1>
          <p className="mt-1 text-sm text-slate-600">환영합니다, {currentUser.name}님.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              window.location.hash = 'create-request';
            }}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500"
          >
            새 요청 생성
          </button>
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-primary-600 transition-colors hover:bg-slate-50"
          >
            새로고침
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="text-sm font-medium text-slate-600">상태 필터</label>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as RequestStatus | 'all')}
          className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {FILTER_LABELS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-b-primary-600" />
          요청 목록을 불러오는 중...
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4">
        {filteredRequests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            onClick={() => {
              window.location.hash = `request/${request.id}`;
            }}
          />
        ))}
        {!loading && filteredRequests.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
            표시할 요청이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
