import React from 'react';
import { postJSON } from '../lib/api';

type Filters = { device?: string; feature_norm?: string; style_tag?: string };
type RetrieveResp = {
  items: { sid: string; en_line: string; score: number; metadata: unknown }[];
  latency_ms?: number;
};

export function Retrieve() {
  const [query, setQuery] = React.useState('');
  const [filters, setFilters] = React.useState<Filters>({});
  const [topK, setTopK] = React.useState(3);
  const [resp, setResp] = React.useState<RetrieveResp | undefined>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  const run = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await postJSON<RetrieveResp>('/v1/retrieve', { query, filters, topK });
      setResp(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve results.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">Retrieve Copy Snippets</h3>
        <p className="text-sm text-slate-600">Search contextual snippets from the vector store with optional filters.</p>
      </header>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-slate-700">Query</label>
            <input
              placeholder="Describe the experience you need copy for."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <InputField
            label="Device"
            placeholder="Example: air_purifier"
            value={filters.device ?? ''}
            onChange={(value) => setFilters((prev) => ({ ...prev, device: value || undefined }))}
          />
          <InputField
            label="Feature"
            placeholder="Example: onboarding_flow"
            value={filters.feature_norm ?? ''}
            onChange={(value) => setFilters((prev) => ({ ...prev, feature_norm: value || undefined }))}
          />
          <InputField
            label="Style Tag"
            placeholder="Example: friendly"
            value={filters.style_tag ?? ''}
            onChange={(value) => setFilters((prev) => ({ ...prev, style_tag: value || undefined }))}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Top K</label>
            <input
              type="number"
              min={1}
              max={20}
              value={topK}
              onChange={(event) => setTopK(Number.parseInt(event.target.value || '3', 10))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {loading ? 'Searching...' : 'Retrieve'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {resp && (
        <div className="space-y-4">
          {typeof resp.latency_ms === 'number' && (
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Latency: {resp.latency_ms.toFixed(0)} ms
            </p>
          )}
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">SID</th>
                  <th className="px-4 py-3 font-semibold">Excerpt</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {resp.items.map((item, index) => (
                  <tr key={`${item.sid}-${index}`} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.sid}</td>
                    <td className="px-4 py-3 text-sm text-slate-800">{item.en_line}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.score.toFixed(3)}</td>
                    <td className="px-4 py-3">
                      <pre className="max-h-40 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                        {JSON.stringify(item.metadata, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function InputField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>
  );
}
