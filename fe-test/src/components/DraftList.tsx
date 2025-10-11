import React from 'react';
import type { Draft } from '../lib/types';

export function DraftList({ drafts }: { drafts: Draft[] }) {
  if (drafts.length === 0) {
    return <p style={{ color: '#6b7280' }}>아직 생성된 드래프트가 없습니다.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {drafts.map((draft) => (
        <div key={draft.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>작성자: {draft.created_by}</span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{new Date(draft.created_at).toLocaleString()}</span>
          </div>
          {draft.versions.map((version) => (
            <div
              key={version.id}
              style={{
                background: '#f9fafb',
                borderRadius: 8,
                padding: 12,
                marginTop: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4b5563' }}>
                <span>버전 {version.version_index + 1}</span>
                <span>{new Date(version.created_at).toLocaleString()}</span>
              </div>
              <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{version.content}</pre>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
