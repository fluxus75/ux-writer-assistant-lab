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

export interface PaginationMeta {
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface RequestListResponse {
  items: RequestSummary[];
  pagination: PaginationMeta | null;
}

export interface GetRequestsParams {
  page?: number;
  page_size?: number;
  status?: string;
  requested_by?: string;
  assigned_writer_id?: string;
}

export function getRequests(params?: GetRequestsParams) {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
  if (params?.status) queryParams.append('status', params.status);
  if (params?.requested_by) queryParams.append('requested_by', params.requested_by);
  if (params?.assigned_writer_id) queryParams.append('assigned_writer_id', params.assigned_writer_id);

  const queryString = queryParams.toString();
  const url = queryString ? `/v1/requests?${queryString}` : '/v1/requests';

  return apiCall<RequestListResponse>(url);
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

// Batch Request Creation API
export interface BatchValidationError {
  row_number: number;
  field: string | null;
  error: string;
}

export interface BatchCreateResponse {
  success: boolean;
  created_count: number;
  created_request_ids: string[];
  errors?: BatchValidationError[];
  validation_summary?: {
    total_rows: number;
    valid_rows: number;
    error_count: number;
  };
}

export async function createBatchRequests(
  file: File,
  assignedWriterId?: string
): Promise<BatchCreateResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const url = assignedWriterId
    ? `/v1/requests/batch?assigned_writer_id=${encodeURIComponent(assignedWriterId)}`
    : '/v1/requests/batch';

  const headers = {
    ...getAuthHeaders(),
  };

  const response = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ''}`);
  }

  return (await response.json()) as BatchCreateResponse;
}

// Get Users (for writer dropdown)
export function getUsers() {
  return apiCall<User[]>('/v1/admin/users');
}

export type { User };
