import React from 'react';
import { useUser } from '../components/UserContext';
import { createBatchRequests, type BatchValidationError } from '../lib/api';

interface CSVPreviewRow {
  [key: string]: string;
}

export function RequestBatchCreate() {
  const { currentUser, availableUsers } = useUser();
  const [selectedWriterId, setSelectedWriterId] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewData, setPreviewData] = React.useState<CSVPreviewRow[]>([]);
  const [previewHeaders, setPreviewHeaders] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [validationErrors, setValidationErrors] = React.useState<BatchValidationError[]>([]);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  if (!currentUser || currentUser.role !== 'designer') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        배치 요청을 생성하려면 디자이너 계정으로 전환하세요.
      </div>
    );
  }

  const writerOptions = availableUsers.filter((user) => user.role === 'writer');

  const downloadTemplate = () => {
    const template = `title,feature_name,context_description,source_text,tone,style_preferences,device
"청소 시작 버튼","Start Cleaning","사용자가 버튼을 눌러 청소 시작","청소를 시작합니다","friendly","concise","robot_vacuum"
"충전 복귀","Return to Charge","배터리 부족 시 자동 충전소 복귀","충전소로 돌아갑니다","informative","brief","robot_vacuum"
"일시정지","Pause Cleaning","청소 중 일시정지 기능","청소를 일시정지합니다","neutral","short","robot_vacuum"`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `request_template_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string): { headers: string[]; rows: CSVPreviewRow[] } => {
    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    // Simple CSV parser (handles basic cases)
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows: CSVPreviewRow[] = [];

    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      // Preview first 5 rows
      const values = parseLine(lines[i]);
      const row: CSVPreviewRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }

    return { headers, rows };
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setError('CSV 파일만 업로드할 수 있습니다.');
      return;
    }

    // Validate file size (1MB max)
    if (file.size > 1024 * 1024) {
      setError('파일 크기는 1MB를 초과할 수 없습니다.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setValidationErrors([]);
    setSuccessMessage(null);

    // Parse and preview CSV
    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      setPreviewHeaders(headers);
      setPreviewData(rows);
    } catch (err) {
      setError('CSV 파일을 읽는 중 오류가 발생했습니다.');
      console.error(err);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedFile) {
      setError('CSV 파일을 선택해주세요.');
      return;
    }

    setUploading(true);
    setError(null);
    setValidationErrors([]);
    setSuccessMessage(null);

    try {
      const result = await createBatchRequests(selectedFile, selectedWriterId || undefined);

      if (result.success) {
        setSuccessMessage(
          `성공! ${result.created_count}개의 요청이 생성되었습니다. 목록 페이지로 이동합니다...`
        );
        setTimeout(() => {
          window.location.hash = '';
        }, 2000);
      } else {
        setValidationErrors(result.errors || []);
        setError(`검증 실패: ${result.validation_summary?.error_count || 0}개의 오류가 발견되었습니다.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '배치 생성 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
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
          <h1 className="text-xl font-semibold text-slate-900">배치 요청 생성</h1>
          <p className="text-sm text-slate-600">CSV 파일로 여러 요청을 한 번에 생성하세요 (최대 30건).</p>
        </header>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Step 1: Writer Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Step 1: 작가 선택 (선택사항)</label>
            <select
              value={selectedWriterId}
              onChange={(e) => setSelectedWriterId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">자동 할당</option>
              {writerOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              선택한 작가가 모든 요청에 일괄 할당됩니다. 선택하지 않으면 나중에 할당됩니다.
            </p>
          </div>

          {/* Step 2: CSV Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Step 2: CSV 파일 업로드</label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-700 hover:file:bg-primary-100"
              />
              <button
                type="button"
                onClick={downloadTemplate}
                className="whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                템플릿 다운로드
              </button>
            </div>
            <p className="text-xs text-slate-500">
              CSV 형식: title, feature_name (필수), context_description, source_text, tone, style_preferences,
              device (선택)
            </p>
          </div>

          {/* Step 3: Preview */}
          {previewData.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Step 3: 미리보기 (최대 5행)</label>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {previewHeaders.map((header) => (
                        <th
                          key={header}
                          className="px-3 py-2 text-left font-semibold text-slate-700 uppercase tracking-wider"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {previewData.map((row, idx) => (
                      <tr key={idx}>
                        {previewHeaders.map((header) => (
                          <td key={header} className="px-3 py-2 text-slate-600 max-w-xs truncate">
                            {row[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-red-800">검증 오류</h3>
              <div className="max-h-60 overflow-y-auto">
                <table className="min-w-full divide-y divide-red-200 text-xs">
                  <thead className="bg-red-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-red-900">행 번호</th>
                      <th className="px-3 py-2 text-left font-semibold text-red-900">필드</th>
                      <th className="px-3 py-2 text-left font-semibold text-red-900">오류</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-200 bg-white">
                    {validationErrors.map((err, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-red-700">{err.row_number}</td>
                        <td className="px-3 py-2 text-red-700">{err.field || 'N/A'}</td>
                        <td className="px-3 py-2 text-red-700">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="rounded-md border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-800">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {error && !validationErrors.length && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
          >
            {uploading ? '업로드 중...' : '업로드 및 생성'}
          </button>
        </form>
      </section>
    </div>
  );
}
