import React from 'react'
import { postJSON } from '../lib/api'

type Filters = { device?: string; feature_norm?: string; style_tag?: string }
type RetrieveResp = { items: {sid:string; en_line:string; score:number; metadata:any }[]; latency_ms?: number }

export function Retrieve(){
  const [query, setQuery] = React.useState('')
  const [filters, setFilters] = React.useState<Filters>({})
  const [topK, setTopK] = React.useState(3)
  const [resp, setResp] = React.useState<RetrieveResp|undefined>()

  async function run(){
    const r = await postJSON<RetrieveResp>('/v1/retrieve', {query, filters, topK})
    setResp(r)
  }

  return <div>
    <div style={{display:'grid', gap:8, maxWidth:600}}>
      <input placeholder="query" value={query} onChange={e=>setQuery(e.target.value)} />
      <input placeholder="device" value={filters.device||''} onChange={e=>setFilters({...filters, device:e.target.value||undefined})} />
      <input placeholder="feature_norm" value={filters.feature_norm||''} onChange={e=>setFilters({...filters, feature_norm:e.target.value||undefined})} />
      <input placeholder="style_tag" value={filters.style_tag||''} onChange={e=>setFilters({...filters, style_tag:e.target.value||undefined})} />
      <input placeholder="topK" type="number" value={topK} onChange={e=>setTopK(parseInt(e.target.value||'3'))} />
      <button onClick={run}>Retrieve</button>
    </div>
    {resp && <div>
      <p>latency: {resp.latency_ms} ms</p>
      <table border={1} cellPadding={4} style={{marginTop:8}}>
        <thead><tr><th>sid</th><th>en_line</th><th>score</th><th>metadata</th></tr></thead>
        <tbody>
        {resp.items.map((it,i)=>(
          <tr key={i}>
            <td>{it.sid}</td>
            <td>{it.en_line}</td>
            <td>{it.score}</td>
            <td><pre style={{margin:0}}>{JSON.stringify(it.metadata)}</pre></td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>}
  </div>
}
