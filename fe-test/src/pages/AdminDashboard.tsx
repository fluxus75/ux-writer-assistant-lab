import React from 'react';
import { UserSwitcher } from '../components/UserSwitcher';
import { useRequests } from '../hooks/useRequests';
import type { RequestStatus } from '../lib/types';
import { Ingest } from './Ingest';
import { Retrieve } from './Retrieve';
import { Translate } from './Translate';

const STATUS_ORDER: RequestStatus[] = ['drafting', 'in_review', 'approved', 'rejected'];

export function AdminDashboard() {
  const [activeSection, setActiveSection] = React.useState<'overview' | 'system'>('overview');
  const [systemTab, setSystemTab] = React.useState<'ingest' | 'retrieve' | 'translate'>('ingest');

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 1040, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Admin Dashboard</h1>
          <p style={{ marginTop: 8, color: '#6b7280' }}>시스템 상태와 도구를 관리하세요.</p>
        </div>
        <UserSwitcher />
      </header>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => setActiveSection('overview')}
          style={buttonStyle(activeSection === 'overview')}
        >
          전체 현황
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('system')}
          style={buttonStyle(activeSection === 'system')}
        >
          시스템 도구
        </button>
      </div>

      {activeSection === 'overview' ? <AdminOverview /> : (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" onClick={() => setSystemTab('ingest')} style={buttonStyle(systemTab === 'ingest')}>
              Ingest
            </button>
            <button type="button" onClick={() => setSystemTab('retrieve')} style={buttonStyle(systemTab === 'retrieve')}>
              Retrieve
            </button>
            <button type="button" onClick={() => setSystemTab('translate')} style={buttonStyle(systemTab === 'translate')}>
              Translate
            </button>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            {systemTab === 'ingest' && <Ingest />}
            {systemTab === 'retrieve' && <Retrieve />}
            {systemTab === 'translate' && <Translate />}
          </div>
        </div>
      )}
    </div>
  );
}

function buttonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 16px',
    borderRadius: 8,
    border: active ? '1px solid #2563eb' : '1px solid #e5e7eb',
    background: active ? '#2563eb' : '#ffffff',
    color: active ? '#ffffff' : '#2563eb',
    fontWeight: 600,
    cursor: 'pointer',
  };
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>요청 현황</h2>
        <button type="button" onClick={() => void refresh()} style={buttonStyle(false)}>
          새로고침
        </button>
      </div>
      {loading && <p>데이터를 불러오는 중...</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {STATUS_ORDER.map((status) => (
          <div
            key={status}
            style={{
              flex: '1 1 180px',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: 16,
              background: '#ffffff',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{status}</h3>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{statusGroups[status]}</p>
          </div>
        ))}
      </div>
      <section style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 18, marginBottom: 12 }}>최근 요청</h3>
        <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f3f4f6', textAlign: 'left' }}>
              <tr>
                <th style={{ padding: 12 }}>제목</th>
                <th style={{ padding: 12 }}>기능</th>
                <th style={{ padding: 12 }}>상태</th>
                <th style={{ padding: 12 }}>업데이트</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: 12 }}>{request.title}</td>
                  <td style={{ padding: 12 }}>{request.feature_name}</td>
                  <td style={{ padding: 12 }}>{request.status}</td>
                  <td style={{ padding: 12 }}>{new Date(request.updated_at).toLocaleString()}</td>
                </tr>
              ))}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                    표시할 요청이 없습니다.
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
