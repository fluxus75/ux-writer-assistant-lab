import React from 'react'
import { postJSON } from '../lib/api'

type IngestResp = { run_id: string, counts: {context:number, glossary:number, style:number}, vector_store?: any }

const DATA_SOURCES = [
  { value: 'input', label: 'Basic Data (input) - 3 items', description: 'Minimal dataset for quick testing' },
  { value: 'mock/day6', label: 'Rich Mock Data (mock/day6) - 10 items', description: 'Comprehensive dataset with air_purifier + robot_vacuum' },
]

export function Ingest(){
  const [resp, setResp] = React.useState<IngestResp|undefined>()
  const [error, setError] = React.useState<string|undefined>()
  const [dataPath, setDataPath] = React.useState<string>('mock/day6')
  const [loading, setLoading] = React.useState(false)

  async function handleIngest(){
    setError(undefined)
    setLoading(true)
    try{
      const r = await postJSON<IngestResp>('/v1/ingest', { data_path: dataPath })
      setResp(r)
    }catch(e:any){
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return <div style={{ padding: 20, fontFamily: 'system-ui', maxWidth: 800 }}>
    <h2>Data Ingestion</h2>
    <p style={{ color: '#6b7280', marginBottom: 20 }}>
      Load data files into Postgres and Qdrant vector store for RAG.
    </p>

    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Select Data Source:</label>
      {DATA_SOURCES.map(source => (
        <div key={source.value} style={{ marginBottom: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              name="dataSource"
              value={source.value}
              checked={dataPath === source.value}
              onChange={(e) => setDataPath(e.target.value)}
              style={{ marginRight: 8 }}
            />
            <div>
              <strong>{source.label}</strong>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{source.description}</div>
            </div>
          </label>
        </div>
      ))}
    </div>

    <button
      onClick={handleIngest}
      disabled={loading}
      style={{
        padding: '10px 20px',
        background: loading ? '#d1d5db' : '#2563eb',
        color: '#ffffff',
        border: 'none',
        borderRadius: 6,
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer'
      }}
    >
      {loading ? 'Loading...' : 'Run Ingest'}
    </button>

    {error && (
      <div style={{ marginTop: 16, padding: 12, background: '#fee2e2', color: '#b91c1c', borderRadius: 6 }}>
        <strong>Error:</strong> {error}
      </div>
    )}

    {resp && (
      <div style={{ marginTop: 16 }}>
        <div style={{ padding: 12, background: '#dcfce7', color: '#15803d', borderRadius: 6, marginBottom: 12 }}>
          ✓ Data ingested successfully from: <code>data/{dataPath}</code>
        </div>
        <pre style={{ background: '#f3f4f6', padding: 12, borderRadius: 6, overflow: 'auto' }}>
          {JSON.stringify(resp, null, 2)}
        </pre>
      </div>
    )}
  </div>
}
