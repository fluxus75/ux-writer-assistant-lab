import React from 'react';
import { DraftList } from '../components/DraftList';
import { DraftSelectionModal } from '../components/DraftSelectionModal';
import { StatusBadge } from '../components/StatusBadge';
import { useUser } from '../components/UserContext';
import { useDrafts } from '../hooks/useDrafts';
import {
  cancelRequest,
  clearDraftSelection,
  createApproval,
  generateDraft,
  getRequest,
  getRequestComments,
  selectDraftVersion,
} from '../lib/api';
import type { Comment, DraftSelectionPayload, DraftVersion, RequestDetail as RequestDetailType } from '../lib/types';

interface RequestDetailProps {
  requestId: string;
  mode: 'view' | 'work';
  onBack: () => void;
}

export function RequestDetail({ requestId, mode, onBack }: RequestDetailProps) {
  const [request, setRequest] = React.useState<RequestDetailType | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { drafts, addDraft, resetDrafts, setDraftSelection } = useDrafts();
  const { currentUser } = useUser();

  const [draftText, setDraftText] = React.useState('');
  const [sourceLanguage, setSourceLanguage] = React.useState('ko');
  const [targetLanguage, setTargetLanguage] = React.useState('en');
  const [generating, setGenerating] = React.useState(false);

  const [selectionModal, setSelectionModal] = React.useState<{
    isOpen: boolean;
    draftId: string;
    version: DraftVersion | null;
  }>({ isOpen: false, draftId: '', version: null });

  const [comments, setComments] = React.useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = React.useState(false);

  const fetchRequest = React.useCallback(async () => {
    try {
      setLoading(true);
      const detail = await getRequest(requestId);
      setRequest(detail);
      resetDrafts(detail.drafts ?? []);
      setError(null);
      setDraftText((prev) => (prev || !detail.source_text ? prev : detail.source_text));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load request details.');
    } finally {
      setLoading(false);
    }
  }, [requestId, resetDrafts]);

  const fetchComments = React.useCallback(async () => {
    try {
      setCommentsLoading(true);
      const response = await getRequestComments(requestId);
      setComments(response.items);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setCommentsLoading(false);
    }
  }, [requestId]);

  React.useEffect(() => {
    void fetchRequest();
    void fetchComments();
  }, [fetchRequest, fetchComments]);

  const handleGenerateDraft = React.useCallback(async () => {
    if (!request) {
      return;
    }
    if (!draftText.trim()) {
      alert('Please provide source text.');
      return;
    }

    setGenerating(true);
    try {
      const draft = await generateDraft({
        request_id: request.id,
        text: draftText,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        num_candidates: 3,
        use_rag: true,
        rag_top_k: 3,
      });
      addDraft(draft);
      setRequest((prev) => (prev ? { ...prev, status: draft.request_status } : prev));
      setDraftText('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate draft.');
    } finally {
      setGenerating(false);
    }
  }, [request, draftText, sourceLanguage, targetLanguage, addDraft]);

  const handleApproval = React.useCallback(
    async (decision: 'approved' | 'rejected') => {
      if (!request) {
        return;
      }
      const comment =
        window.prompt(
          `Please share why this request is being ${decision === 'approved' ? 'approved' : 'sent back'}.`,
        ) ?? undefined;
      try {
        const response = await createApproval({ request_id: request.id, decision, comment });
        setRequest({ ...request, status: response.request_status });
        alert(`Request ${decision === 'approved' ? 'approved' : 'sent back for revisions'}.`);
        // Refresh comments to show new approval comment
        await fetchComments();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to update request.');
      }
    },
    [request, fetchComments],
  );

  const handleOpenSelectionModal = React.useCallback((draftId: string, version: DraftVersion) => {
    setSelectionModal({ isOpen: true, draftId, version });
  }, []);

  const handleConfirmSelection = React.useCallback(
    async (payload: DraftSelectionPayload) => {
      try {
        const result = await selectDraftVersion(selectionModal.draftId, payload);

        // Update draft selection state
        setDraftSelection(result.draft_id, result.version_id ?? null);
        setRequest((prev) => (prev ? { ...prev, status: result.request_status } : prev));

        // If there are validation issues, return the result to the modal
        if (
          (result.guardrail_result && !result.guardrail_result.passes) ||
          (result.grammar_check_result && result.grammar_check_result.has_issues)
        ) {
          return result;
        }

        // Success - close modal
        setSelectionModal({ isOpen: false, draftId: '', version: null });

        // Refresh request and comments to get updated drafts and comments
        await fetchRequest();
        await fetchComments();
      } catch (err) {
        throw err; // Let modal handle error display
      }
    },
    [selectionModal.draftId, setDraftSelection, fetchRequest, fetchComments],
  );

  const handleCancelSelection = React.useCallback(() => {
    setSelectionModal({ isOpen: false, draftId: '', version: null });
  }, []);

  const handleClearSelection = React.useCallback(
    async (draftId: string) => {
      try {
        const result = await clearDraftSelection(draftId);
        setDraftSelection(result.draft_id, result.version_id ?? null);
        setRequest((prev) => (prev ? { ...prev, status: result.request_status } : prev));
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to clear selection.');
      }
    },
    [setDraftSelection],
  );

  const handleCancelRequest = React.useCallback(async () => {
    if (!request) {
      return;
    }
    const reason =
      window.prompt('요청을 취소하는 이유를 입력하세요 (선택사항):') ?? undefined;

    if (window.confirm('정말 이 요청을 취소하시겠습니까?')) {
      try {
        const response = await cancelRequest(request.id, { reason });
        setRequest({ ...request, status: response.status });
        alert('요청이 취소되었습니다.');
        onBack(); // Return to list
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to cancel request.');
      }
    }
  }, [request, onBack]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-b-primary-600" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="space-y-4 rounded-xl border border-red-100 bg-red-50 p-6 text-red-600">
        <p>{error ?? 'Request not found.'}</p>
        <button
          type="button"
          onClick={() => {
            void fetchRequest();
          }}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500"
        >
          Try Again
        </button>
      </div>
    );
  }

  const canGenerateDraft =
    mode === 'work' &&
    currentUser?.role === 'writer' &&
    (request.status === 'drafting' || request.status === 'needs_revision');
  const canReview =
    mode === 'view' && currentUser?.role === 'designer' && request.status === 'in_review';
  const canCancel =
    mode === 'view' &&
    currentUser?.role === 'designer' &&
    currentUser?.id === request.requested_by &&
    (request.status === 'drafting' || request.status === 'needs_revision');

  return (
    <div className="space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-500"
      >
        ← 목록으로 돌아가기
      </button>

      <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{request.title}</h1>
            <p className="mt-1 text-sm text-slate-600">기능: {request.feature_name}</p>
          </div>
          <StatusBadge status={request.status} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {request.context_description && (
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-600">컨텍스트</h2>
              <p className="text-sm leading-relaxed text-slate-700">{request.context_description}</p>
            </div>
          )}
          {request.source_text && (
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-600">원문</h2>
              <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {request.source_text}
              </p>
            </div>
          )}
          {request.tone && (
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-600">톤</h2>
              <p className="text-sm text-slate-700">{request.tone}</p>
            </div>
          )}
          {request.style_preferences && (
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-600">스타일 가이드</h2>
              <p className="text-sm text-slate-700">{request.style_preferences}</p>
            </div>
          )}
        </div>
      </section>

      {canGenerateDraft && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">드래프트 생성</h2>
            <p className="text-sm text-slate-600">원문과 대상 언어 정보를 입력하세요.</p>
          </header>
          <div className="space-y-3">
            <textarea
              placeholder="번역하거나 다시 작성할 원문을 입력하세요."
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              rows={5}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">원본 언어</label>
                <input
                  value={sourceLanguage}
                  onChange={(event) => setSourceLanguage(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600">대상 언어</label>
                <input
                  value={targetLanguage}
                  onChange={(event) => setTargetLanguage(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleGenerateDraft()}
              disabled={generating}
              className="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-b-white" />
                  생성 중...
                </span>
              ) : (
                '드래프트 생성'
              )}
            </button>
          </div>
        </section>
      )}

      {canReview && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <header className="mb-4 space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">검토 작업</h2>
            <p className="text-sm text-slate-600">요청을 승인하거나 피드백과 함께 반려합니다.</p>
          </header>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleApproval('approved')}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-500"
            >
              승인
            </button>
            <button
              type="button"
              onClick={() => void handleApproval('rejected')}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500"
            >
              변경 요청
            </button>
          </div>
        </section>
      )}

      {canCancel && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <header className="mb-4 space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">요청 취소</h2>
            <p className="text-sm text-slate-600">작업 전에 요청을 취소할 수 있습니다.</p>
          </header>
          <button
            type="button"
            onClick={() => void handleCancelRequest()}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            요청 취소
          </button>
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">드래프트 버전</h2>
          <p className="text-sm text-slate-600">생성된 드래프트를 비교하고 가장 좋은 것을 선택하세요.</p>
        </div>
        <DraftList
          drafts={drafts}
          canSelect={
            mode === 'work' &&
            currentUser?.role === 'writer' &&
            request.status !== 'approved' &&
            request.status !== 'rejected'
          }
          onOpenSelectionModal={handleOpenSelectionModal}
          onClearSelection={handleClearSelection}
        />
      </section>

      {/* Activity Timeline / Comments */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">활동 기록</h2>
          <p className="text-sm text-slate-600">요청과 관련된 모든 코멘트와 피드백을 확인하세요.</p>
        </div>
        {commentsLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-b-primary-600" />
            코멘트를 불러오는 중...
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
            아직 코멘트가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => {
              const draft = comment.draft_version_id
                ? drafts.find((d) => d.versions.some((v) => v.id === comment.draft_version_id))
                : null;
              const version = draft?.versions.find((v) => v.id === comment.draft_version_id);

              return (
                <div
                  key={comment.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">작성자 ID: {comment.author_id}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(comment.created_at).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    {comment.status === 'resolved' && (
                      <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                        해결됨
                      </span>
                    )}
                  </div>
                  {version && (
                    <div className="mb-2 text-xs text-slate-600">
                      드래프트 버전 {version.version_index}에 대한 코멘트
                    </div>
                  )}
                  <p className="text-sm leading-relaxed text-slate-700">{comment.body}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Draft Selection Modal */}
      {selectionModal.version && (
        <DraftSelectionModal
          isOpen={selectionModal.isOpen}
          draftId={selectionModal.draftId}
          version={selectionModal.version}
          onConfirm={handleConfirmSelection}
          onCancel={handleCancelSelection}
        />
      )}
    </div>
  );
}
