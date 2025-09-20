import React from 'react'
import { translate, TranslateResponse, TranslateRequest } from '../lib/api'

function splitCommaInput(input: string): string[] {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function parseGlossary(input: string): Record<string, string> | undefined {
  const entries = splitCommaInput(input)
  if (!entries.length) return undefined
  const map: Record<string, string> = {}
  entries.forEach((pair) => {
    const [src, tgt] = pair.split(':').map((part) => part.trim())
    if (src && tgt) {
      map[src] = tgt
    }
  })
  return Object.keys(map).length ? map : undefined
}

export function Translate() {
  const [text, setText] = React.useState('로봇이 충전 거점으로 돌아갑니다.')
  const [sourceLanguage, setSourceLanguage] = React.useState('ko')
  const [targetLanguage, setTargetLanguage] = React.useState('en')
  const [tone, setTone] = React.useState('Friendly, helpful')
  const [styleGuides, setStyleGuides] = React.useState('Concise,Device UI tone')
  const [contextIds, setContextIds] = React.useState('SID-0001,SID-0002')
  const [lengthMax, setLengthMax] = React.useState('40')
  const [forbiddenTerms, setForbiddenTerms] = React.useState('charger')
  const [replaceFrom, setReplaceFrom] = React.useState('charger')
  const [replaceTo, setReplaceTo] = React.useState('charging station')
  const [glossaryInput, setGlossaryInput] = React.useState('charger:charging station')
  const [useRag, setUseRag] = React.useState(true)
  const [ragTopK, setRagTopK] = React.useState('3')
  const [guardrails, setGuardrails] = React.useState(true)

  const [resp, setResp] = React.useState<TranslateResponse | undefined>()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | undefined>()

  async function run() {
    const hints: Record<string, unknown> = {}
    const lengthValue = Number(lengthMax)
    if (!Number.isNaN(lengthValue) && lengthMax.trim()) {
      hints.length_max = lengthValue
    }
    const forbidden = splitCommaInput(forbiddenTerms)
    if (forbidden.length) {
      hints.forbidden_terms = forbidden
    }
    if (replaceFrom.trim() && replaceTo.trim()) {
      hints.replace_map = { [replaceFrom.trim()]: replaceTo.trim() }
    }

    const options: NonNullable<TranslateRequest['options']> = {
      use_rag: useRag,
      guardrails,
    }
    const ragValue = Number(ragTopK)
    if (!Number.isNaN(ragValue) && ragTopK.trim()) {
      options.rag_top_k = ragValue
    }
    if (tone.trim()) {
      options.tone = tone.trim()
    }
    const styleGuideList = splitCommaInput(styleGuides)
    if (styleGuideList.length) {
      options.style_guides = styleGuideList
    }

    const payload: TranslateRequest = {
      text,
      source_language: sourceLanguage.trim(),
      target_language: targetLanguage.trim(),
      context_ids: splitCommaInput(contextIds),
      hints: Object.keys(hints).length ? hints : undefined,
      glossary: parseGlossary(glossaryInput),
      options,
    }

    setLoading(true)
    setError(undefined)
    try {
      const result = await translate(payload)
      setResp(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setResp(undefined)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Source text"
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ flex: 1 }}
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value)}
            placeholder="Source language"
          />
          <input
            style={{ flex: 1 }}
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            placeholder="Target language"
          />
        </div>
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder="Tone (optional)"
        />
        <input
          value={styleGuides}
          onChange={(e) => setStyleGuides(e.target.value)}
          placeholder="Style guides (comma separated)"
        />
        <input
          value={contextIds}
          onChange={(e) => setContextIds(e.target.value)}
          placeholder="Context IDs (comma separated)"
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={useRag} onChange={(e) => setUseRag(e.target.checked)} />
            Use retrieval (RAG)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={guardrails} onChange={(e) => setGuardrails(e.target.checked)} />
            Apply guardrails
          </label>
          <input
            style={{ width: 120 }}
            type="number"
            value={ragTopK}
            onChange={(e) => setRagTopK(e.target.value)}
            placeholder="Top K"
            min={1}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ width: 120 }}
            type="number"
            value={lengthMax}
            onChange={(e) => setLengthMax(e.target.value)}
            placeholder="Length max"
          />
          <input
            style={{ flex: 1 }}
            value={forbiddenTerms}
            onChange={(e) => setForbiddenTerms(e.target.value)}
            placeholder="Forbidden terms (comma separated)"
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ flex: 1 }}
            value={replaceFrom}
            onChange={(e) => setReplaceFrom(e.target.value)}
            placeholder="Replace term"
          />
          <input
            style={{ flex: 1 }}
            value={replaceTo}
            onChange={(e) => setReplaceTo(e.target.value)}
            placeholder="Replacement"
          />
        </div>
        <input
          value={glossaryInput}
          onChange={(e) => setGlossaryInput(e.target.value)}
          placeholder="Glossary (comma separated key:value pairs)"
        />
        <button onClick={run} disabled={loading}>
          {loading ? 'Translating…' : 'Translate'}
        </button>
        {error && <div style={{ color: 'red' }}>{error}</div>}
      </div>

      {resp && (
        <div style={{ marginTop: 16 }}>
          <h4>Selected</h4>
          <p>{resp.selected}</p>
          <h4>LLM Metadata</h4>
          <pre>{JSON.stringify(resp.metadata.llm, null, 2)}</pre>
          <h4>Guardrails</h4>
          <pre>{JSON.stringify(resp.metadata.guardrails, null, 2)}</pre>
          <h4>Retrieval</h4>
          <pre>{JSON.stringify(resp.metadata.retrieval, null, 2)}</pre>
          <h4>Candidates</h4>
          <ul>
            {resp.candidates.map((c, i) => (
              <li key={i}>{c.text}</li>
            ))}
          </ul>
          <h4>Rationale</h4>
          <p>{resp.rationale}</p>
        </div>
      )}
    </div>
  )
}
