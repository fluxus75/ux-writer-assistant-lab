import React from 'react';
import { useUser } from '../components/UserContext';
import { createRequest, getDevices, type Device } from '../lib/api';
import type { CreateRequestPayload } from '../lib/types';

export function RequestCreate() {
  const { currentUser, availableUsers } = useUser();
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = React.useState(true);
  const [form, setForm] = React.useState<CreateRequestPayload>({
    title: '',
    feature_name: '',
    context_description: '',
    source_text: '',
    tone: '',
    style_preferences: '',
    assigned_writer_id: '',
  });
  const [selectedDevice, setSelectedDevice] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load devices
  React.useEffect(() => {
    const loadDevices = async () => {
      try {
        const result = await getDevices(false); // Only active devices
        setDevices(result);
      } catch (err) {
        console.error('Failed to load devices:', err);
      } finally {
        setLoadingDevices(false);
      }
    };
    void loadDevices();
  }, []);

  if (!currentUser || currentUser.role !== 'designer') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        새 요청을 생성하려면 디자이너 계정으로 전환하세요.
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
      setError('Title and feature name are required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: CreateRequestPayload = {
        title: form.title,
        feature_name: form.feature_name,
        context_description: form.context_description || undefined,
        source_text: form.source_text || undefined,
        tone: form.tone || undefined,
        style_preferences: form.style_preferences || undefined,
        constraints: selectedDevice ? { device: selectedDevice } : undefined,
        assigned_writer_id: form.assigned_writer_id || undefined,
      };
      const created = await createRequest(payload);
      window.location.hash = `request/${created.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => {
          window.location.hash = '';
        }}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-500"
      >
        ← 목록으로 돌아가기
      </button>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="space-y-1 border-b border-slate-100 pb-4">
          <h1 className="text-xl font-semibold text-slate-900">새 요청 생성</h1>
          <p className="text-sm text-slate-600">작업을 설명하고 작가에게 할당하세요.</p>
        </header>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.title}
              onChange={(event) => handleChange('title', event.target.value)}
              placeholder="Example: Onboarding welcome message"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">디바이스</label>
            <select
              value={selectedDevice}
              onChange={(event) => setSelectedDevice(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={loadingDevices}
            >
              <option value="">선택 안 함</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.display_name_ko}
                </option>
              ))}
            </select>
            {loadingDevices && <p className="text-xs text-slate-500">디바이스 목록 로딩 중...</p>}
            <p className="text-xs text-slate-500">
              디바이스를 선택하면 feature_norm이 자동으로 생성됩니다
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              기능 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.feature_name}
              onChange={(event) => handleChange('feature_name', event.target.value)}
              placeholder="예: 충전 복귀, 청소 시작"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
            <p className="text-xs text-slate-500">
              한글로 입력하면 자동으로 영문 식별자로 변환됩니다 (예: "충전 복귀" → "return_to_charging")
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">컨텍스트</label>
            <textarea
              value={form.context_description}
              onChange={(event) => handleChange('context_description', event.target.value)}
              rows={4}
              placeholder="시나리오, 요구사항, 목표를 공유하세요."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">원문</label>
            <textarea
              value={form.source_text}
              onChange={(event) => handleChange('source_text', event.target.value)}
              rows={3}
              placeholder="참고 문구 또는 원문을 제공하세요."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">톤</label>
            <input
              value={form.tone}
              onChange={(event) => handleChange('tone', event.target.value)}
              placeholder="Example: friendly and conversational"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">스타일 가이드</label>
            <input
              value={form.style_preferences}
              onChange={(event) => handleChange('style_preferences', event.target.value)}
              placeholder="Example: align with brand voice guidelines"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">작가 할당</label>
            <select
              value={form.assigned_writer_id ?? ''}
              onChange={(event) => handleChange('assigned_writer_id', event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">나중에 자동 할당</option>
              {writerOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
          >
            {submitting ? '제출 중...' : '요청 생성'}
          </button>
        </form>
      </section>
    </div>
  );
}
