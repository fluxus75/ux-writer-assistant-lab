export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body||{})
  });
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export interface TranslateOptions {
  tone?: string;
  style_guides?: string[];
  use_rag?: boolean;
  rag_top_k?: number;
  guardrails?: boolean;
  temperature?: number;
  max_output_tokens?: number;
}

export interface TranslateRequest {
  text: string;
  source_language: string;
  target_language: string;
  run_id?: string;
  context_ids?: string[];
  hints?: Record<string, unknown>;
  glossary?: Record<string, string>;
  options?: TranslateOptions;
}

export interface TranslationCandidate { text: string }

export interface TranslateResponse {
  selected: string;
  candidates: TranslationCandidate[];
  rationale: string;
  metadata: {
    llm: { latency_ms: number; model: string };
    retrieval: { items: unknown[]; latency_ms: number };
    guardrails: { passes: boolean; violations: string[]; fixed: string };
  };
}

export function translate(payload: TranslateRequest) {
  return postJSON<TranslateResponse>('/v1/translate', payload);
}
