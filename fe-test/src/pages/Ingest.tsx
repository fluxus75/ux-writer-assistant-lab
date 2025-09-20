import React from 'react'
import { postJSON } from '../lib/api'

type IngestResp = { run_id: string, counts: {context:number, glossary:number, style:number} }

export function Ingest(){
  const [resp, setResp] = React.useState<IngestResp|undefined>()
  const [error, setError] = React.useState<string|undefined>()

  async function handleIngest(){
    setError(undefined)
    try{
      const r = await postJSON<IngestResp>('/v1/ingest', {})
      setResp(r)
    }catch(e:any){
      setError(e.message)
    }
  }

  return <div>
    <p>Reads files from <code>../data/input</code> in backend and builds in-memory indexes.</p>
    <button onClick={handleIngest}>Run Ingest</button>
    {error && <p style={{color:'red'}}>{error}</p>}
    {resp && <pre>{JSON.stringify(resp,null,2)}</pre>}
  </div>
}
