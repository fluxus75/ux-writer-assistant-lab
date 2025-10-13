import React from 'react';
import type { CreateDevicePayload, Device } from '../lib/api';
import { createDevice, deleteDevice, getDevices, updateDevice } from '../lib/api';

export function DeviceManagement() {
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [editingDevice, setEditingDevice] = React.useState<Device | null>(null);

  const loadDevices = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDevices(true); // Include inactive
      setDevices(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const handleDelete = async (deviceId: string, hardDelete: boolean) => {
    const action = hardDelete ? '완전히 삭제' : '비활성화';
    if (!confirm(`정말로 이 디바이스를 ${action}하시겠습니까?`)) {
      return;
    }

    try {
      await deleteDevice(deviceId, hardDelete);
      await loadDevices();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete device');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">디바이스 관리</h2>
          <p className="text-sm text-slate-600">시스템에서 사용할 디바이스 taxonomy를 관리합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500"
        >
          + 새 디바이스
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-b-primary-600" />
          로딩 중...
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {showCreateForm && (
        <DeviceForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={() => {
            setShowCreateForm(false);
            void loadDevices();
          }}
        />
      )}

      {editingDevice && (
        <DeviceEditForm
          device={editingDevice}
          onClose={() => setEditingDevice(null)}
          onSuccess={() => {
            setEditingDevice(null);
            void loadDevices();
          }}
        />
      )}

      {!loading && devices.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">한글명</th>
                <th className="px-4 py-3 font-semibold">영문명</th>
                <th className="px-4 py-3 font-semibold">카테고리</th>
                <th className="px-4 py-3 font-semibold">상태</th>
                <th className="px-4 py-3 font-semibold">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {devices.map((device) => (
                <tr key={device.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{device.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{device.display_name_ko}</td>
                  <td className="px-4 py-3 text-slate-600">{device.display_name_en}</td>
                  <td className="px-4 py-3 text-slate-600">{device.category || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        device.active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {device.active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingDevice(device)}
                        className="text-primary-600 hover:text-primary-500"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(device.id, false)}
                        className="text-slate-600 hover:text-slate-900"
                      >
                        비활성화
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(device.id, true)}
                        className="text-red-600 hover:text-red-500"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DeviceForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = React.useState<CreateDevicePayload>({
    id: '',
    display_name_ko: '',
    display_name_en: '',
    category: '',
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Validate ID format
    if (!/^[a-z][a-z0-9_]*$/.test(form.id)) {
      setError('ID는 소문자, 숫자, 언더스코어만 사용 가능합니다 (예: robot_vacuum)');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createDevice({
        ...form,
        category: form.category || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create device');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">새 디바이스 생성</h3>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              ID (영문) <span className="text-red-500">*</span>
            </label>
            <input
              value={form.id}
              onChange={(e) => setForm({ ...form, id: e.target.value })}
              placeholder="robot_vacuum"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
            <p className="text-xs text-slate-500">소문자, 숫자, 언더스코어만 사용 (예: robot_vacuum)</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              한글명 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.display_name_ko}
              onChange={(e) => setForm({ ...form, display_name_ko: e.target.value })}
              placeholder="로봇 청소기"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              영문명 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.display_name_en}
              onChange={(e) => setForm({ ...form, display_name_en: e.target.value })}
              placeholder="Robot Vacuum"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">카테고리 (선택)</label>
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="home_appliance"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeviceEditForm({
  device,
  onClose,
  onSuccess,
}: {
  device: Device;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = React.useState({
    display_name_ko: device.display_name_ko,
    display_name_en: device.display_name_en,
    category: device.category || '',
    active: device.active,
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setSubmitting(true);
    setError(null);
    try {
      await updateDevice(device.id, {
        display_name_ko: form.display_name_ko,
        display_name_en: form.display_name_en,
        category: form.category || undefined,
        active: form.active,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update device');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">디바이스 수정: {device.id}</h3>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              한글명 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.display_name_ko}
              onChange={(e) => setForm({ ...form, display_name_ko: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              영문명 <span className="text-red-500">*</span>
            </label>
            <input
              value={form.display_name_en}
              onChange={(e) => setForm({ ...form, display_name_en: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">카테고리</label>
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4"
            />
            <label className="text-sm font-medium text-slate-700">활성화</label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
