import React from 'react';
import { Pagination } from '../components/Pagination';
import { RequestCard } from '../components/RequestCard';
import { useUser } from '../components/UserContext';
import { usePaginatedRequests } from '../hooks/usePaginatedRequests';
import type { RequestStatus } from '../lib/types';

const FILTER_LABELS: { value: RequestStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'drafting', label: '작성중' },
  { value: 'needs_revision', label: '재작업 필요' },
  { value: 'in_review', label: '검토중' },
  { value: 'approved', label: '승인됨' },
  { value: 'rejected', label: '반려됨' },
  { value: 'cancelled', label: '취소됨' },
];

export function DesignerDashboard() {
  const { requests, pagination, loading, error, setFilters, setPage, setPageSize, refresh } = usePaginatedRequests();
  const { currentUser } = useUser();
  const [filter, setFilter] = React.useState<RequestStatus | 'all'>('all');

  const handleFilterChange = (newFilter: RequestStatus | 'all') => {
    setFilter(newFilter);
    setFilters({
      status: newFilter === 'all' ? undefined : newFilter,
    });
  };

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">상태 필터</label>
          <select
            value={filter}
            onChange={(event) => handleFilterChange(event.target.value as RequestStatus | 'all')}
            className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {FILTER_LABELS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {pagination && (
          <div className="text-sm text-slate-600">
            전체 {pagination.total_count}건
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-b-primary-600" />
          요청 목록을 불러오는 중...
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4">
        {requests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            onClick={() => {
              window.location.hash = `request/${request.id}`;
            }}
          />
        ))}
        {!loading && requests.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
            표시할 요청이 없습니다.
          </div>
        )}
      </div>

      {pagination && pagination.total_pages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.total_pages}
          onPageChange={setPage}
          pageSize={pagination.page_size}
          onPageSizeChange={setPageSize}
          totalCount={pagination.total_count}
        />
      )}
    </div>
  );
}
