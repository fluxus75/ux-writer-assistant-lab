import React from 'react';
import { postJSON } from '../lib/api';

type IngestResp = {
  run_id: string;
  counts: { context: number; glossary: number; style: number };
  vector_store?: unknown;
};

const DATA_SOURCES = [
  { value: 'input', label: 'Basic Data (input) – 3 items', description: 'Minimal dataset for quick testing.' },
  {
    value: 'mock/day6',
    label: 'Rich Mock Data (mock/day6) – 10 items',
    description: 'Comprehensive dataset including air_purifier and robot_vacuum.',
  },
] as const;

export function Ingest() {
  const [resp, setResp] = React.useState<IngestResp | undefined>();
  const [error, setError] = React.useState<string | undefined>();
  const [dataPath, setDataPath] = React.useState<string>('mock/day6');
  const [loading, setLoading] = React.useState(false);

  const handleIngest = async () => {
    setError(undefined);
    setLoading(true);
    try {
      const result = await postJSON<IngestResp>('/v1/ingest', { data_path: dataPath });
      setResp(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">Data Ingestion</h3>
        <p className="text-sm text-slate-600">Load structured files into Postgres and Qdrant for RAG pipelines.</p>
      </header>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-sm font-semibold text-slate-700">Select data source</p>
        <div className="space-y-3">
          {DATA_SOURCES.map((source) => (
            <label
              key={source.value}
              className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-primary-200 hover:bg-primary-50"
            >
              <input
                type="radio"
                name="dataSource"
                value={source.value}
                checked={dataPath === source.value}
                onChange={(event) => setDataPath(event.target.value)}
                className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900">{source.label}</div>
                <div className="text-xs text-slate-600">{source.description}</div>
              </div>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void handleIngest()}
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
        >
          {loading ? 'Processing...' : 'Run Ingest'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          <strong className="font-semibold">Error: </strong>
          {error}
        </div>
      )}

      {resp && (
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            ✅ Data ingested successfully from <code className="rounded bg-white px-1 py-0.5 text-xs">data/{dataPath}</code>
          </div>
          <pre className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-4 text-xs text-slate-100">
            {JSON.stringify(resp, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
