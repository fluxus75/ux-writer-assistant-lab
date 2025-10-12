import React from 'react';
import { useRequests } from '../hooks/useRequests';
import type { RequestStatus } from '../lib/types';
import { Ingest } from './Ingest';
import { Retrieve } from './Retrieve';
import { Translate } from './Translate';

const STATUS_ORDER: RequestStatus[] = ['drafting', 'in_review', 'approved', 'rejected'];
const STATUS_LABELS: Record<RequestStatus, string> = {
  drafting: '작성중',
  in_review: '검토중',
  approved: '승인됨',
  rejected: '반려됨',
};

type AdminDashboardProps = {
  initialSection?: 'overview' | 'system';
  initialSystemTab?: 'ingest' | 'retrieve' | 'translate';
};

export function AdminDashboard({
  initialSection = 'overview',
  initialSystemTab = 'ingest',
}: AdminDashboardProps) {
  const [activeSection, setActiveSection] = React.useState<'overview' | 'system'>(initialSection);
  const [systemTab, setSystemTab] = React.useState<'ingest' | 'retrieve' | 'translate'>(initialSystemTab);

  React.useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  React.useEffect(() => {
    setSystemTab(initialSystemTab);
  }, [initialSystemTab]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const targetHash = activeSection === 'system' ? '#system-tools' : '#';
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  }, [activeSection]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">관리자 대시보드</h1>
          <p className="mt-1 text-sm text-slate-600">요청 흐름을 모니터링하고 시스템 도구에 액세스합니다.</p>
        </div>
        <SectionToggle activeSection={activeSection} onChange={setActiveSection} />
      </header>

      {activeSection === 'overview' ? <AdminOverview /> : <SystemTools tab={systemTab} onChangeTab={setSystemTab} />}
    </div>
  );
}

function SectionToggle({
  activeSection,
  onChange,
}: {
  activeSection: 'overview' | 'system';
  onChange: (section: 'overview' | 'system') => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-slate-200 bg-white p-1 text-sm font-semibold text-slate-600 shadow-sm">
      <button
        type="button"
        onClick={() => onChange('overview')}
        className={`rounded-md px-4 py-2 transition-colors ${
          activeSection === 'overview'
            ? 'bg-primary-600 text-white shadow-sm'
            : 'hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        전체 현황
      </button>
      <button
        type="button"
        onClick={() => onChange('system')}
        className={`rounded-md px-4 py-2 transition-colors ${
          activeSection === 'system'
            ? 'bg-primary-600 text-white shadow-sm'
            : 'hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        시스템 도구
      </button>
    </div>
  );
}

function AdminOverview() {
  const { requests, loading, error, refresh } = useRequests();

  const statusGroups = React.useMemo(() => {
    const counts: Record<RequestStatus, number> = {
      drafting: 0,
      in_review: 0,
      approved: 0,
      rejected: 0,
    };
    requests.forEach((request) => {
      counts[request.status] += 1;
    });
    return counts;
  }, [requests]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">요청 상태</h2>
          <p className="text-sm text-slate-600">모든 요청의 진행 상황을 추적합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-primary-600 transition-colors hover:bg-slate-50"
        >
          새로고침
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="text-sm font-medium text-slate-500">{STATUS_LABELS[status]}</span>
            <p className="mt-3 text-3xl font-bold text-slate-900">{statusGroups[status]}</p>
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-b-primary-600" />
          요청 데이터를 불러오는 중...
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">최근 요청</h3>
          <p className="text-sm text-slate-600">최종 업데이트순 정렬.</p>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">제목</th>
                <th className="px-4 py-3 font-semibold">기능</th>
                <th className="px-4 py-3 font-semibold">상태</th>
                <th className="px-4 py-3 font-semibold">업데이트</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{request.title}</td>
                  <td className="px-4 py-3 text-slate-600">{request.feature_name}</td>
                  <td className="px-4 py-3 text-slate-600">{STATUS_LABELS[request.status]}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(request.updated_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                    요청을 찾을 수 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SystemTools({
  tab,
  onChangeTab,
}: {
  tab: 'ingest' | 'retrieve' | 'translate';
  onChangeTab: (tab: 'ingest' | 'retrieve' | 'translate') => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">시스템 도구</h2>
        <p className="text-sm text-slate-600">데이터 수집 및 검색 유틸리티를 실행합니다.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['ingest', 'retrieve', 'translate'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChangeTab(value)}
            className={`rounded-md border px-4 py-2 text-sm font-semibold transition-colors ${
              tab === value
                ? 'border-primary-600 bg-primary-50 text-primary-600'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {value === 'ingest' && '수집'}
            {value === 'retrieve' && '검색'}
            {value === 'translate' && '번역'}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {tab === 'ingest' && <Ingest />}
        {tab === 'retrieve' && <Retrieve />}
        {tab === 'translate' && <Translate />}
      </div>
    </div>
  );
}
