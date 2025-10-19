import React from 'react';
import { StatusBadge } from '../components/StatusBadge';
import { useUser } from '../components/UserContext';
import { useRequests } from '../hooks/useRequests';
import { formatDateTime, truncateText } from '../lib/utils';
import type { RequestSummary } from '../lib/types';

function RequestTable({ requests }: { requests: RequestSummary[] }) {
  if (requests.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        표시할 요청이 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                제목
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                원문 (KO)
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                요청자
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                상태
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                변경 일시
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {requests.map((request) => (
              <tr key={request.id} className="transition-colors hover:bg-slate-50">
                <td className="px-3 py-2.5 text-sm font-medium text-slate-900">
                  {truncateText(request.title, 20)}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-600">
                  {truncateText(request.source_text, 30)}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-600">
                  {request.requested_by_name || '-'}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={request.status} />
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-500">
                  {formatDateTime(request.updated_at)}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      window.location.hash = `work/${request.id}`;
                    }}
                    className="rounded bg-primary-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary-500"
                  >
                    열기
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WriterDashboard() {
  const { requests, loading, error, refresh } = useRequests();
  const { currentUser } = useUser();

  const assignedRequests = React.useMemo(() => {
    if (!currentUser) {
      return [];
    }
    return requests.filter((request) => request.assigned_writer_id === currentUser.id);
  }, [currentUser, requests]);

  const drafting = assignedRequests.filter((request) => request.status === 'drafting');
  const needsRevision = assignedRequests.filter((request) => request.status === 'needs_revision');
  const inReview = assignedRequests.filter((request) => request.status === 'in_review');

  if (!currentUser) {
    return null;
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">작가 대시보드</h1>
          <p className="mt-1 text-sm text-slate-600">할당된 작업을 추적하고 드래프트를 다듬습니다.</p>
        </div>
        <div className="flex flex-wrap gap-3">
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

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-b-primary-600" />
          할당된 요청을 불러오는 중...
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">작성 요청</h2>
            <p className="text-sm text-slate-600">AI 결과를 검토하거나 새로 작성합니다.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {drafting.length}
          </span>
        </div>
        <RequestTable requests={drafting} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">재작성 요청</h2>
            <p className="text-sm text-slate-600">디자이너가 변경을 요청한 항목입니다.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {needsRevision.length}
          </span>
        </div>
        <RequestTable requests={needsRevision} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">디자이너 리뷰요청</h2>
            <p className="text-sm text-slate-600">현재 디자이너 검토 중인 요청입니다.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {inReview.length}
          </span>
        </div>
        <RequestTable requests={inReview} />
      </section>
    </div>
  );
}
