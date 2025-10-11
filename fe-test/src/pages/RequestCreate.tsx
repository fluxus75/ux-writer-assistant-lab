import React from 'react';
import { UserSwitcher } from '../components/UserSwitcher';
import { useUser } from '../components/UserContext';
import { createRequest } from '../lib/api';
import type { CreateRequestPayload } from '../lib/types';

export function RequestCreate() {
  const { currentUser, availableUsers } = useUser();
  const [form, setForm] = React.useState<CreateRequestPayload>({
    title: '',
    feature_name: '',
    context_description: '',
    tone: '',
    style_preferences: '',
    assigned_writer_id: '',
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!currentUser || currentUser.role !== 'designer') {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 720, margin: '0 auto' }}>
        <p>요청을 생성하려면 디자이너 역할로 전환하세요.</p>
      </div>
    );
  }

  const writerOptions = availableUsers.filter((user) => user.role === 'writer');

  const handleChange = <K extends keyof CreateRequestPayload>(key: K, value: CreateRequestPayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.feature_name.trim()) {
      setError('제목과 기능명을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: CreateRequestPayload = {
        title: form.title,
        feature_name: form.feature_name,
        context_description: form.context_description || undefined,
        tone: form.tone || undefined,
        style_preferences: form.style_preferences || undefined,
        constraints: undefined,
        assigned_writer_id: form.assigned_writer_id || undefined,
      };
      const created = await createRequest(payload);
      window.location.hash = `request/${created.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 생성 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <button type="button" onClick={() => (window.location.hash = '')} style={{ border: 'none', background: 'transparent', color: '#2563eb' }}>
          ← 뒤로가기
        </button>
        <UserSwitcher />
      </div>
      <h1 style={{ marginBottom: 16 }}>새 요청 생성</h1>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>제목 *</span>
          <input
            value={form.title}
            onChange={(event) => handleChange('title', event.target.value)}
            placeholder="예: 온보딩 안내 개선"
            style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
            required
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>기능명 *</span>
          <input
            value={form.feature_name}
            onChange={(event) => handleChange('feature_name', event.target.value)}
            placeholder="예: 회원가입"
            style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
            required
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>컨텍스트</span>
          <textarea
            value={form.context_description}
            onChange={(event) => handleChange('context_description', event.target.value)}
            rows={4}
            placeholder="상황과 요구사항을 설명하세요."
            style={{ padding: 12, borderRadius: 8, border: '1px solid #d1d5db' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>톤</span>
          <input
            value={form.tone}
            onChange={(event) => handleChange('tone', event.target.value)}
            placeholder="예: 친근하고 따뜻한 톤"
            style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>스타일 선호</span>
          <input
            value={form.style_preferences}
            onChange={(event) => handleChange('style_preferences', event.target.value)}
            placeholder="예: 문장 길이는 20자 이내"
            style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>라이터 지정</span>
          <select
            value={form.assigned_writer_id ?? ''}
            onChange={(event) => handleChange('assigned_writer_id', event.target.value)}
            style={{ padding: 10, borderRadius: 8, border: '1px solid #d1d5db' }}
          >
            <option value="">자동 배정</option>
            {writerOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #2563eb',
            background: '#2563eb',
            color: '#ffffff',
            fontWeight: 600,
          }}
        >
          {submitting ? '생성중...' : '요청 생성'}
        </button>
      </form>
    </div>
  );
}
