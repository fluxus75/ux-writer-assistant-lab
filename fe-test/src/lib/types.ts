export type UserRole = 'designer' | 'writer' | 'admin';

export interface User {
  id: string;
  role: UserRole;
  name: string;
  email: string;
}

export type RequestStatus = 'drafting' | 'in_review' | 'approved' | 'rejected' | 'needs_revision' | 'cancelled';

export interface RequestSummary {
  id: string;
  title: string;
  feature_name: string;
  status: RequestStatus;
  requested_by: string;
  assigned_writer_id?: string | null;
  created_at: string;
  updated_at: string;
  draft_count: number;
}

export interface RequestDetail extends RequestSummary {
  context_description?: string | null;
  source_text?: string | null;
  tone?: string | null;
  style_preferences?: string | null;
  constraints_json?: unknown;
  drafts?: Draft[];
}

export interface DraftVersion {
  id: string;
  version_index: number;
  content: string;
  metadata_json?: Record<string, unknown> | null;
  created_at: string;
}

export interface Draft {
  id: string;
  request_id: string;
  llm_run_id?: string | null;
  generation_method: 'ai' | 'manual';
  created_by: string;
  created_at: string;
  versions: DraftVersion[];
  request_status: RequestStatus;
  selected_version_id?: string | null;
}

export interface CreateRequestPayload {
  title: string;
  feature_name: string;
  context_description?: string;
  source_text?: string;
  tone?: string;
  style_preferences?: string;
  constraints?: Record<string, unknown>;
  assigned_writer_id?: string;
}

export interface CreateDraftPayload {
  request_id: string;
  text: string;
  source_language: string;
  target_language: string;
  hints?: Record<string, unknown>;
  glossary?: Record<string, string>;
  num_candidates?: number;
  use_rag?: boolean;
  rag_top_k?: number;
  temperature?: number;
}

export interface ApprovalPayload {
  request_id: string;
  decision: 'approved' | 'rejected';
  comment?: string;
}

export interface ApprovalResponse {
  id: string;
  request_id: string;
  decision: 'approved' | 'rejected';
  comment?: string | null;
  decided_by: string;
  decided_at: string;
  request_status: RequestStatus;
}

export interface GrammarIssue {
  type: 'grammar' | 'spelling' | 'style' | 'tone' | 'system';
  message: string;
  severity: 'error' | 'warning';
}

export interface GrammarCheckResult {
  has_issues: boolean;
  issues: GrammarIssue[];
  suggestions?: string[];
  confidence?: number;
}

export interface GuardrailResult {
  passes: boolean;
  violations: string[];
  fixed?: string;
  text?: string;
}

export interface DraftSelectionPayload {
  version_id: string;
  comment?: string;
  edited_content?: string;
}

export interface DraftSelectionState {
  draft_id: string;
  version_id?: string | null;
  selected_by?: string | null;
  selected_at?: string | null;
  request_status: RequestStatus;
  guardrail_result?: GuardrailResult | null;
  grammar_check_result?: GrammarCheckResult | null;
  comment_id?: string | null;
  new_version_created?: boolean;
}
