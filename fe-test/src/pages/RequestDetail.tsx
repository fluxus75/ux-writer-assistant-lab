import React from 'react';
import { DraftList } from '../components/DraftList';
import { StatusBadge } from '../components/StatusBadge';
import { UserSwitcher } from '../components/UserSwitcher';
import { useUser } from '../components/UserContext';
import { useDrafts } from '../hooks/useDrafts';
import { createApproval, generateDraft, getRequest } from '../lib/api';
import type { RequestDetail as RequestDetailType } from '../lib/types';

interface RequestDetailProps {
  requestId: string;
  mode: 'view' | 'work';
  onBack: () => void;
}

export function RequestDetail({ requestId, mode, onBack }: RequestDetailProps) {
  const [request, setRequest] = React.useState<RequestDetailType | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { drafts, addDraft, resetDrafts } = useDrafts();
  const { currentUser } = useUser();

  const [draftText, setDraftText] = React.useState('');
  const [sourceLanguage, setSourceLanguage] = React.useState('ko');
  const [targetLanguage, setTargetLanguage] = React.useState('en');
  const [generating, setGenerating] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const detail = await getRequest(requestId);
        setRequest(detail);
        resetDrafts([]);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : '요청을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [requestId, resetDrafts]);

  const handleGenerateDraft = React.useCallback(async () => {
    if (!request) {
      return;
    }
    if (!draftText.trim()) {
      alert('번역할 텍스트를 입력해주세요.');
      return;
    }

    setGenerating(true);
    try {
      const draft = await generateDraft({
        request_id: request.id,
        text: draftText,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        num_candidates: 3,
        use_rag: true,
        rag_top_k: 3,
      });
      addDraft(draft);
      setRequest({ ...request, status: draft.request_status });
      setDraftText('');
    } catch (err) {
      alert(err instanceof Error ? err.message : '드래프트 생성 중 오류가 발생했습니다.');
    } finally {
      setGenerating(false);
    }
  }, [request, draftText, sourceLanguage, targetLanguage, addDraft]);

  const handleApproval = React.useCallback(
    async (decision: 'approved' | 'rejected') => {
      if (!request) {
        return;
      }
      const comment = window.prompt(`${decision === 'approved' ? '승인' : '거절'} 사유를 입력하세요.`) ?? undefined;
      try {
        const response = await createApproval({ request_id: request.id, decision, comment });
        setRequest({ ...request, status: response.request_status });
        alert(`요청이 ${decision === 'approved' ? '승인' : '거절'}되었습니다.`);
      } catch (err) {
        alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
      }
    },
    [request],
  );

  if (loading) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 960, margin: '0 auto' }}>
        <p>요청을 불러오는 중...</p>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 960, margin: '0 auto' }}>
        <button type="button" onClick={onBack} style={{ marginBottom: 16 }}>
          ← 뒤로가기
        </button>
        <p style={{ color: '#b91c1c' }}>{error ?? '요청 정보를 찾을 수 없습니다.'}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <button type="button" onClick={onBack} style={{ border: 'none', background: 'transparent', color: '#2563eb' }}>
          ← 뒤로가기
        </button>
        <UserSwitcher />
      </div>
      <h1 style={{ marginBottom: 8 }}>{request.title}</h1>
      <p style={{ margin: '4px 0', color: '#4b5563' }}>기능: {request.feature_name}</p>
      <p style={{ margin: '4px 0' }}>
        상태: <StatusBadge status={request.status} />
      </p>
      {request.context_description && <p style={{ margin: '8px 0', color: '#4b5563' }}>{request.context_description}</p>}
      {request.tone && (
        <p style={{ margin: '8px 0', color: '#6b7280' }}>
          톤: <strong>{request.tone}</strong>
        </p>
      )}
      {request.style_preferences && (
        <p style={{ margin: '8px 0', color: '#6b7280' }}>
          스타일 선호: <strong>{request.style_preferences}</strong>
        </p>
      )}

      {mode === 'work' && currentUser?.role === 'writer' && request.status === 'drafting' && (
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, margin: '24px 0' }}>
          <h2 style={{ marginTop: 0 }}>AI 드래프트 생성</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <textarea
              placeholder="번역할 텍스트를 입력하세요"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              rows={5}
              style={{ padding: 12, borderRadius: 8, border: '1px solid #d1d5db' }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <input
                placeholder="소스 언어"
                value={sourceLanguage}
                onChange={(event) => setSourceLanguage(event.target.value)}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
              />
              <input
                placeholder="타겟 언어"
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
              />
            </div>
            <button
              type="button"
              onClick={() => void handleGenerateDraft()}
              disabled={generating}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #2563eb',
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              {generating ? '생성중...' : 'AI 드래프트 생성'}
            </button>
          </div>
        </section>
      )}

      {mode === 'view' && currentUser?.role === 'designer' && request.status === 'in_review' && (
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, margin: '24px 0' }}>
          <h2 style={{ marginTop: 0 }}>검토 및 승인</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => void handleApproval('approved')}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #15803d',
                background: '#15803d',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              승인
            </button>
            <button
              type="button"
              onClick={() => void handleApproval('rejected')}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #b91c1c',
                background: '#b91c1c',
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              거절
            </button>
          </div>
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20 }}>드래프트</h2>
        <DraftList drafts={drafts} />
      </section>
    </div>
  );
}
