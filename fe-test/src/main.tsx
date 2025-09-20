import React from 'react'
import { createRoot } from 'react-dom/client'
import { Ingest } from './pages/Ingest'
import { Retrieve } from './pages/Retrieve'
import { Translate } from './pages/Translate'

function App() {
  const [tab, setTab] = React.useState<'ingest'|'retrieve'|'translate'>('ingest')
  return (
    <div style={{fontFamily:'system-ui', padding:16}}>
      <h1>UX Writer Assistant — FE Test</h1>
      <div style={{display:'flex', gap:8, margin:'12px 0'}}>
        <button onClick={()=>setTab('ingest')}>Ingest</button>
        <button onClick={()=>setTab('retrieve')}>Retrieve</button>
        <button onClick={()=>setTab('translate')}>Translate</button>
      </div>
      {tab==='ingest' && <Ingest/>}
      {tab==='retrieve' && <Retrieve/>}
      {tab==='translate' && <Translate/>}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App/>)
