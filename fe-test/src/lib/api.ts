import type {
  ApprovalPayload,
  ApprovalResponse,
  CreateDraftPayload,
  CreateRequestPayload,
  Draft,
  DraftSelectionState,
  RequestDetail,
  RequestSummary,
  User,
} from './types';
import { loadUser } from './userStorage';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

function getAuthHeaders(): Record<string, string> {
  const user = loadUser();
  if (!user) {
    return {};
  }
  return {
    'X-User-Role': user.role,
    'X-User-Id': user.id,
  };
}

export async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(options.headers ?? {}),
  } as Record<string, string>;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ''}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  return apiCall<T>(path, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export interface TranslateOptions {
  tone?: string;
  style_guides?: string[];
  use_rag?: boolean;
  rag_top_k?: number;
  guardrails?: boolean;
  temperature?: number;
  max_output_tokens?: number;
  num_candidates?: number;
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

export interface TranslationCandidate {
  text: string;
}

export interface RetrievalItem {
  text: string;
  user_utterance?: string;
  response_case?: string;
  [key: string]: unknown;
}

export interface TranslateResponse {
  selected: string;
  candidates: TranslationCandidate[];
  rationale: string;
  metadata: {
    llm: { latency_ms: number; model: string };
    retrieval: { items: RetrievalItem[]; latency_ms: number };
    guardrails: { passes: boolean; violations: string[]; fixed: string };
  };
}

export function translate(payload: TranslateRequest) {
  return postJSON<TranslateResponse>('/v1/translate', payload);
}

export function getRequests() {
  return apiCall<{ items: RequestSummary[] }>('/v1/requests');
}

export function getRequest(id: string) {
  return apiCall<RequestDetail>(`/v1/requests/${id}`);
}

export function createRequest(payload: CreateRequestPayload) {
  return apiCall<RequestDetail>('/v1/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function generateDraft(payload: CreateDraftPayload) {
  return apiCall<Draft>('/v1/drafts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createApproval(payload: ApprovalPayload) {
  return apiCall<ApprovalResponse>('/v1/approvals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function selectDraftVersion(draftId: string, versionId: string) {
  return postJSON<DraftSelectionState>(`/v1/drafts/${draftId}/selection`, { version_id: versionId });
}

export function clearDraftSelection(draftId: string) {
  return apiCall<DraftSelectionState>(`/v1/drafts/${draftId}/selection`, {
    method: 'DELETE',
  });
}

// Device Taxonomy API
export interface Device {
  id: string;
  display_name_ko: string;
  display_name_en: string;
  category?: string;
  active: boolean;
}

export interface CreateDevicePayload {
  id: string;
  display_name_ko: string;
  display_name_en: string;
  category?: string;
}

export interface UpdateDevicePayload {
  display_name_ko?: string;
  display_name_en?: string;
  category?: string;
  active?: boolean;
}

export function getDevices(includeInactive = false) {
  return apiCall<Device[]>(`/v1/admin/devices?include_inactive=${includeInactive}`);
}

export function createDevice(payload: CreateDevicePayload) {
  return postJSON<Device>('/v1/admin/devices', payload);
}

export function updateDevice(deviceId: string, payload: UpdateDevicePayload) {
  return apiCall<Device>(`/v1/admin/devices/${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteDevice(deviceId: string, hardDelete = false) {
  return apiCall<void>(`/v1/admin/devices/${deviceId}?hard_delete=${hardDelete}`, {
    method: 'DELETE',
  });
}

// Feature Normalization API
export interface NormalizeFeaturePayload {
  feature_name: string;
  device: string;
}

export interface NormalizeFeatureResponse {
  feature_norm: string;
}

export function normalizeFeature(payload: NormalizeFeaturePayload) {
  return postJSON<NormalizeFeatureResponse>('/v1/taxonomy/normalize-feature', payload);
}

export type { User };
