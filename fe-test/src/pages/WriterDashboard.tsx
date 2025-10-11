import React from 'react';
import { RequestCard } from '../components/RequestCard';
import { UserSwitcher } from '../components/UserSwitcher';
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
  const inReview = assignedRequests.filter((request) => request.status === 'in_review');

  if (!currentUser) {
    return null;
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 960, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Writer Dashboard</h1>
          <p style={{ marginTop: 8, color: '#6b7280' }}>할당된 요청을 관리하세요.</p>
        </div>
        <UserSwitcher />
      </header>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
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

      {loading && <p>요청을 불러오는 중...</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>작업 대기중 ({drafting.length})</h2>
        <div style={{ display: 'grid', gap: 16 }}>
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
          {!loading && drafting.length === 0 && <p style={{ color: '#6b7280' }}>대기중인 요청이 없습니다.</p>}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>검토중 ({inReview.length})</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          {inReview.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onClick={() => {
                window.location.hash = `work/${request.id}`;
              }}
            />
          ))}
          {!loading && inReview.length === 0 && <p style={{ color: '#6b7280' }}>검토중인 요청이 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}
