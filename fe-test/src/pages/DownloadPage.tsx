import React, { useEffect, useState } from 'react';
import { ApprovedRequestItem, downloadRequestsExcel, getApprovedRequests, getDevices, getUsers } from '../lib/api';
import { formatDateTime, truncateText } from '../lib/utils';

export function DownloadPage() {
  const [requests, setRequests] = useState<ApprovedRequestItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [writerId, setWriterId] = useState('');
  const [device, setDevice] = useState('');

  // Filter options
  const [writers, setWriters] = useState<{ id: string; name: string }[]>([]);
  const [devices, setDevices] = useState<{ id: string; display_name_ko: string }[]>([]);

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [usersData, devicesData] = await Promise.all([getUsers(), getDevices()]);
        setWriters(usersData.filter((u) => u.role === 'writer').map((u) => ({ id: u.id, name: u.name })));
        setDevices(devicesData);
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    };
    void loadFilterOptions();
  }, []);

  // Load approved requests
  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        writer_id: writerId || undefined,
        device: device || undefined,
      };
      const response = await getApprovedRequests(params);
      setRequests(response.items);
      setSelectedIds(new Set()); // Clear selection when reloading
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approved requests');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    void loadRequests();
  }, []);

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSelectedIds = new Set(selectedIds);
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id);
    } else {
      newSelectedIds.add(id);
    }
    setSelectedIds(newSelectedIds);
  };

  // Toggle all
  const toggleAll = () => {
    if (selectedIds.size === requests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map((r) => r.id)));
    }
  };

  // Download Excel
  const handleDownload = async () => {
    if (selectedIds.size === 0) {
      alert('다운로드할 항목을 선택해주세요.');
      return;
    }

    setDownloading(true);
    try {
      const blob = await downloadRequestsExcel(Array.from(selectedIds));

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `approved_requests_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download Excel file');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">문구 다운로드</h1>
        <p className="mt-1 text-sm text-slate-600">승인완료된 문구를 조회하고 Excel로 다운로드하세요.</p>
      </header>

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">필터</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">시작 날짜</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">종료 날짜</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Writer</label>
            <select
              value={writerId}
              onChange={(e) => setWriterId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">전체</option>
              {writers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Device</label>
            <select
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">전체</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.display_name_ko}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              void loadRequests();
            }}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500"
          >
            조회
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              전체 <span className="font-semibold text-slate-900">{requests.length}</span>건
              {selectedIds.size > 0 && (
                <span className="ml-2">
                  / 선택 <span className="font-semibold text-primary-600">{selectedIds.size}</span>건
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleDownload}
              disabled={selectedIds.size === 0 || downloading}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {downloading ? 'Excel 다운로드 중...' : 'Excel 다운로드'}
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-b-primary-600" />
            승인완료 목록을 불러오는 중...
          </div>
        )}

        {error && <p className="px-4 py-3 text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={requests.length > 0 && selectedIds.size === requests.length}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primary-600 focus:ring-2 focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Device
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    제목
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    원문 (KO)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    영문안
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Writer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    승인일자
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.map((request) => (
                  <tr key={request.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(request.id)}
                        onChange={() => toggleSelection(request.id)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primary-600 focus:ring-2 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{request.device || '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {truncateText(request.title, 30)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {truncateText(request.source_text, 40)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {truncateText(request.approved_draft_content, 40)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {request.assigned_writer_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {formatDateTime(request.approved_at)}
                    </td>
                  </tr>
                ))}
                {!loading && requests.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                      조회된 승인완료 항목이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
