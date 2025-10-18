import React from 'react';
import { RequestCard } from '../components/RequestCard';
import { useUser } from '../components/UserContext';
import { useRequests } from '../hooks/useRequests';

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
            <h2 className="text-lg font-semibold text-slate-900">작성 대기 중</h2>
            <p className="text-sm text-slate-600">AI 결과를 검토하거나 새로 작성합니다.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {drafting.length}
          </span>
        </div>
        <div className="grid gap-4">
          {drafting.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              showDraftButton
              onClick={() => {
                window.location.hash = `work/${request.id}`;
              }}
            />
          ))}
          {!loading && drafting.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
              작성 대기 중인 작업이 없습니다.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">재작업 필요</h2>
            <p className="text-sm text-slate-600">디자이너가 변경을 요청한 항목입니다.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {needsRevision.length}
          </span>
        </div>
        <div className="grid gap-4">
          {needsRevision.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              showDraftButton
              onClick={() => {
                window.location.hash = `work/${request.id}`;
              }}
            />
          ))}
          {!loading && needsRevision.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
              재작업이 필요한 요청이 없습니다.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">검토중</h2>
            <p className="text-sm text-slate-600">현재 디자이너 검토 중인 요청입니다.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {inReview.length}
          </span>
        </div>
        <div className="grid gap-4">
          {inReview.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onClick={() => {
                window.location.hash = `work/${request.id}`;
              }}
            />
          ))}
          {!loading && inReview.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
              검토 중인 요청이 없습니다.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
