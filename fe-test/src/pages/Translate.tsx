import React from 'react';
import { translate, TranslateRequest, TranslateResponse, RetrievalItem } from '../lib/api';

function splitCommaInput(input: string): string[] {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseGlossary(input: string): Record<string, string> | undefined {
  const entries = splitCommaInput(input);
  if (!entries.length) {
    return undefined;
  }
  const map: Record<string, string> = {};
  entries.forEach((pair) => {
    const [src, tgt] = pair.split(':').map((part) => part.trim());
    if (src && tgt) {
      map[src] = tgt;
    }
  });
  return Object.keys(map).length ? map : undefined;
}

export function Translate() {
  const [text, setText] = React.useState('The purifier detects air quality automatically.');
  const [sourceLanguage, setSourceLanguage] = React.useState('ko');
  const [targetLanguage, setTargetLanguage] = React.useState('en');
  const [tone, setTone] = React.useState('Friendly, helpful');
  const [styleGuides, setStyleGuides] = React.useState('Concise,Device UI tone');
  const [contextIds, setContextIds] = React.useState('SID-0001,SID-0002');
  const [lengthMax, setLengthMax] = React.useState('40');
  const [forbiddenTerms, setForbiddenTerms] = React.useState('charger');
  const [replaceFrom, setReplaceFrom] = React.useState('charger');
  const [replaceTo, setReplaceTo] = React.useState('charging station');
  const [glossaryInput, setGlossaryInput] = React.useState('charger:charging station');
  const [useRag, setUseRag] = React.useState(true);
  const [ragTopK, setRagTopK] = React.useState('3');
  const [guardrails, setGuardrails] = React.useState(true);

  const [resp, setResp] = React.useState<TranslateResponse | undefined>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  const run = async () => {
    const hints: Record<string, unknown> = {};
    const lengthValue = Number(lengthMax);
    if (!Number.isNaN(lengthValue) && lengthMax.trim()) {
      hints.length_max = lengthValue;
    }
    const forbidden = splitCommaInput(forbiddenTerms);
    if (forbidden.length) {
      hints.forbidden_terms = forbidden;
    }
    if (replaceFrom.trim() && replaceTo.trim()) {
      hints.replace_map = { [replaceFrom.trim()]: replaceTo.trim() };
    }

    const options: NonNullable<TranslateRequest['options']> = {
      use_rag: useRag,
      guardrails,
      num_candidates: 3,
    };
    const ragValue = Number(ragTopK);
    if (!Number.isNaN(ragValue) && ragTopK.trim()) {
      options.rag_top_k = ragValue;
    }
    if (tone.trim()) {
      options.tone = tone.trim();
    }
    const styleGuideList = splitCommaInput(styleGuides);
    if (styleGuideList.length) {
      options.style_guides = styleGuideList;
    }

    const payload: TranslateRequest = {
      text,
      source_language: sourceLanguage.trim(),
      target_language: targetLanguage.trim(),
      context_ids: splitCommaInput(contextIds),
      hints: Object.keys(hints).length ? hints : undefined,
      glossary: parseGlossary(glossaryInput),
      options,
    };

    setLoading(true);
    setError(undefined);
    try {
      const result = await translate(payload);
      setResp(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResp(undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">Translate & Rephrase</h3>
        <p className="text-sm text-slate-600">Generate localized copy with optional guardrails and retrieval hints.</p>
      </header>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700">Source Text</label>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <InputField
            label="Source Language"
            value={sourceLanguage}
            onChange={setSourceLanguage}
            placeholder="ko"
          />
          <InputField
            label="Target Language"
            value={targetLanguage}
            onChange={setTargetLanguage}
            placeholder="en"
          />
        </div>
        <InputField label="Tone" value={tone} onChange={setTone} placeholder="Friendly, helpful" />
        <InputField
          label="Style Guides"
          value={styleGuides}
          onChange={setStyleGuides}
          placeholder="Comma separated values"
        />
        <InputField
          label="Context IDs"
          value={contextIds}
          onChange={setContextIds}
          placeholder="Comma separated values"
        />

        <div className="grid gap-3 md:grid-cols-2">
          <InputField
            label="Length Max"
            type="number"
            value={lengthMax}
            onChange={setLengthMax}
            placeholder="40"
          />
          <InputField
            label="Forbidden Terms"
            value={forbiddenTerms}
            onChange={setForbiddenTerms}
            placeholder="Comma separated values"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <InputField
            label="Replace Term"
            value={replaceFrom}
            onChange={setReplaceFrom}
            placeholder="charger"
          />
          <InputField
            label="Replacement"
            value={replaceTo}
            onChange={setReplaceTo}
            placeholder="charging station"
          />
        </div>

        <InputField
          label="Glossary"
          value={glossaryInput}
          onChange={setGlossaryInput}
          placeholder="key:value pairs separated by commas"
        />

        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={useRag}
              onChange={(event) => setUseRag(event.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500"
            />
            Enable retrieval (RAG)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={guardrails}
              onChange={(event) => setGuardrails(event.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500"
            />
            Apply guardrails
          </label>
          <div className="w-24">
            <InputField label="RAG Top K" type="number" value={ragTopK} onChange={setRagTopK} placeholder="3" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
        >
          {loading ? 'Translating...' : 'Translate'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {resp && (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <section>
            <h4 className="text-sm font-semibold text-slate-700">Selected Output</h4>
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
              {resp.selected}
            </p>
          </section>

          <MetadataBlock title="LLM Metadata" data={resp.metadata.llm} />
          <MetadataBlock title="Guardrails" data={resp.metadata.guardrails} />
          <RetrievalExamples retrieval={resp.metadata.retrieval} />

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">Candidates</h4>
            <ul className="space-y-2">
              {resp.candidates.map((candidate, index) => (
                <li key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                  {candidate.text}
                </li>
              ))}
            </ul>
          </section>

          {resp.rationale && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Rationale</h4>
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">{resp.rationale}</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>
  );
}

function MetadataBlock({ title, data }: { title: string; data: unknown }) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
      <pre className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-4 text-xs text-slate-100">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}

function RetrievalExamples({ retrieval }: { retrieval: { items: RetrievalItem[]; latency_ms: number } }) {
  const hasItems = retrieval.items && retrieval.items.length > 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Retrieval Examples</h4>
        <span className="text-xs text-slate-500">{retrieval.latency_ms}ms</span>
      </div>

      {hasItems ? (
        <div className="space-y-3">
          {retrieval.items.map((item, index) => (
            <div
              key={index}
              className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              {item.user_utterance && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    User Utterance
                  </p>
                  <p className="text-sm text-slate-700">{item.user_utterance}</p>
                </div>
              )}

              {item.response_case && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Context
                  </p>
                  <p className="text-sm text-slate-700">{item.response_case}</p>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Response
                </p>
                <p className="text-sm font-medium text-slate-900">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          No retrieval examples found
        </p>
      )}
    </section>
  );
}
