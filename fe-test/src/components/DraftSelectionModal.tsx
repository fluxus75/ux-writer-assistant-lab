import React, { useState } from 'react';
import type {
  DraftSelectionPayload,
  DraftSelectionState,
  DraftVersion,
  GrammarCheckResult,
  GuardrailResult,
} from '../lib/types';

interface DraftSelectionModalProps {
  isOpen: boolean;
  draftId: string;
  version: DraftVersion;
  onConfirm: (payload: DraftSelectionPayload) => Promise<DraftSelectionState | void>;
  onCancel: () => void;
}

export function DraftSelectionModal({
  isOpen,
  draftId,
  version,
  onConfirm,
  onCancel,
}: DraftSelectionModalProps) {
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState(version.content);
  const [comment, setComment] = useState('');
  const [validationResult, setValidationResult] = useState<DraftSelectionState | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes or version changes
  React.useEffect(() => {
    if (isOpen) {
      setEditMode(false);
      setEditedContent(version.content);
      setComment('');
      setValidationResult(null);
      setError(null);
    }
  }, [isOpen, version.content]);

  if (!isOpen) {
    return null;
  }

  const hasIssues =
    validationResult?.guardrail_result && !validationResult.guardrail_result.passes;
  const hasGrammarIssues =
    validationResult?.grammar_check_result && validationResult.grammar_check_result.has_issues;

  const handleSubmit = async () => {
    setIsValidating(true);
    setError(null);

    try {
      const payload: DraftSelectionPayload = {
        version_id: version.id,
        comment: comment.trim() || undefined,
        edited_content: editMode && editedContent.trim() !== version.content ? editedContent.trim() : undefined,
      };

      const result = await onConfirm(payload);

      // If we get a result with validation issues, show them
      if (result && (result.guardrail_result || result.grammar_check_result)) {
        setValidationResult(result);
        setIsValidating(false);
        // Don't close modal if there are issues - let user decide
        if (
          (result.guardrail_result && !result.guardrail_result.passes) ||
          (result.grammar_check_result && result.grammar_check_result.has_issues)
        ) {
          return;
        }
      }

      // Success - modal will close via parent
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select version');
      setIsValidating(false);
    }
  };

  const handleForceSubmit = async () => {
    // User decided to save despite warnings
    // Modal already has validation result, just close
    onCancel(); // This should trigger the parent to complete the selection
  };

  const handleResetToOriginal = () => {
    setEditedContent(version.content);
  };

  const charCount = editedContent.length;
  const originalCharCount = version.content.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">드래프트 버전 선택</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 transition-colors hover:text-slate-600"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-4">
          {/* Original Text Section */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">원본 드래프트</label>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
              {version.content}
            </div>
            <p className="text-xs text-slate-500">{originalCharCount} characters</p>
          </div>

          {/* Edit Mode Toggle */}
          <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              id="edit-mode"
              checked={editMode}
              onChange={(e) => setEditMode(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-2 focus:ring-primary-500"
            />
            <label htmlFor="edit-mode" className="cursor-pointer text-sm font-medium text-slate-700">
              이 문구를 수정하여 사용
            </label>
          </div>

          {/* Edit Area (conditional) */}
          {editMode && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">수정된 텍스트</label>
                {editedContent !== version.content && (
                  <button
                    type="button"
                    onClick={handleResetToOriginal}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-500"
                  >
                    원본으로 되돌리기
                  </button>
                )}
              </div>
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="수정할 내용을 입력하세요"
              />
              <p className="text-xs text-slate-500">
                {charCount} characters
                {charCount !== originalCharCount && ` (${charCount > originalCharCount ? '+' : ''}${charCount - originalCharCount})`}
              </p>
            </div>
          )}

          {/* Comment Section */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">선택 의견 (선택사항)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="이 버전을 선택한 이유나 추가 의견을 입력하세요"
            />
          </div>

          {/* Validation Results */}
          {validationResult && (
            <div className="space-y-4">
              {/* Guardrail Results */}
              {validationResult.guardrail_result && (
                <ValidationSection
                  title="스타일 가이드 검사"
                  result={validationResult.guardrail_result}
                  type="guardrail"
                />
              )}

              {/* Grammar Check Results */}
              {validationResult.grammar_check_result && (
                <GrammarCheckSection result={validationResult.grammar_check_result} />
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            취소
          </button>

          {validationResult && (hasIssues || hasGrammarIssues) ? (
            <>
              <button
                type="button"
                onClick={() => setValidationResult(null)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                재수정
              </button>
              <button
                type="button"
                onClick={handleForceSubmit}
                className="rounded-md border border-yellow-600 bg-yellow-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-yellow-500"
              >
                그래도 저장
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isValidating}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isValidating ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-b-white" />
                  {editMode ? '검사 중...' : '선택 중...'}
                </span>
              ) : (
                '선택하기'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Guardrail Validation Section Component
function ValidationSection({
  title,
  result,
  type,
}: {
  title: string;
  result: GuardrailResult;
  type: 'guardrail';
}) {
  const passes = result.passes;

  return (
    <div className={`rounded-md border p-4 ${passes ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {passes ? (
            <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <h3 className={`text-sm font-semibold ${passes ? 'text-green-800' : 'text-yellow-800'}`}>{title}</h3>
          {passes ? (
            <p className="text-sm text-green-700">모든 스타일 규칙을 통과했습니다.</p>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-800">위반 사항:</p>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-yellow-700">
                {result.violations.map((violation, idx) => (
                  <li key={idx}>{violation}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Grammar Check Section Component
function GrammarCheckSection({ result }: { result: GrammarCheckResult }) {
  const hasIssues = result.has_issues;
  const errors = result.issues.filter((issue) => issue.severity === 'error');
  const warnings = result.issues.filter((issue) => issue.severity === 'warning');

  return (
    <div
      className={`rounded-md border p-4 ${hasIssues ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {hasIssues ? (
            <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <h3 className={`text-sm font-semibold ${hasIssues ? 'text-blue-800' : 'text-green-800'}`}>
            문법 및 스타일 검사
          </h3>

          {!hasIssues ? (
            <p className="text-sm text-green-700">문법 오류가 발견되지 않았습니다.</p>
          ) : (
            <div className="space-y-3">
              {errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-800">오류:</p>
                  <ul className="list-inside list-disc space-y-0.5 text-sm text-red-700">
                    {errors.map((issue, idx) => (
                      <li key={idx}>
                        [{issue.type}] {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {warnings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-800">경고:</p>
                  <ul className="list-inside list-disc space-y-0.5 text-sm text-blue-700">
                    {warnings.map((issue, idx) => (
                      <li key={idx}>
                        [{issue.type}] {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.suggestions && result.suggestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-800">💡 제안:</p>
                  <ul className="list-inside list-disc space-y-0.5 text-sm text-blue-700">
                    {result.suggestions.map((suggestion, idx) => (
                      <li key={idx}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {result.confidence !== undefined && (
            <p className="text-xs text-slate-600">신뢰도: {(result.confidence * 100).toFixed(0)}%</p>
          )}
        </div>
      </div>
    </div>
  );
}
