"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "classnames";

import { ApiError, useApiClient } from "../../../lib/api";
import { useRole } from "../../../components/role-context";

type RequestDetail = {
  id: string;
  title: string;
  feature_name: string;
  status: string;
  assigned_writer_id: string | null;
  created_at: string;
  updated_at: string;
  draft_count: number;
  context_description?: string | null;
  tone?: string | null;
  style_preferences?: string | null;
  constraints_json?: Record<string, unknown> | null;
};

type Comment = {
  id: string;
  request_id: string;
  draft_version_id: string | null;
  author_id: string;
  body: string;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
};

type CommentsResponse = {
  items?: Comment[];
};

type DraftGenerationPayload = {
  request_id: string;
  text: string;
  source_language: string;
  target_language: string;
  num_candidates?: number;
  use_rag?: boolean;
};

const statusColors: Record<string, string> = {
  drafting: "bg-slate-100 text-slate-700",
  in_review: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (error) {
    console.error("Failed to format date", error);
    return value;
  }
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatConstraintValue(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "—";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error("Failed to stringify constraint value", error);
    return String(value);
  }
}

export function RequestDetailView({ requestId }: { requestId: string }) {
  const api = useApiClient();
  const { role, userId } = useRole();
  const queryClient = useQueryClient();
  
  const [draftText, setDraftText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("ko");
  const [targetLanguage, setTargetLanguage] = useState("en");

  const {
    data: detail,
    isLoading: isLoadingDetail,
    isError: isDetailError,
    error: detailError,
  } = useQuery<RequestDetail, ApiError>({
    queryKey: ["requests", requestId, "detail"],
    queryFn: async () => api.get<RequestDetail>(`/v1/requests/${requestId}`),
  });

  const {
    data: commentsResponse,
    isLoading: isLoadingComments,
    isError: isCommentsError,
    error: commentsError,
  } = useQuery<CommentsResponse, ApiError>({
    queryKey: ["requests", requestId, "comments"],
    queryFn: async () => api.get<CommentsResponse>(`/v1/requests/${requestId}/comments`),
    enabled: Boolean(requestId),
  });

  const comments = commentsResponse?.items ?? [];
  const openComments = useMemo(() => comments.filter((comment) => comment.status === "open"), [comments]);
  const resolvedComments = useMemo(
    () => comments.filter((comment) => comment.status === "resolved"),
    [comments]
  );
  const latestComments = useMemo(() => comments.slice(-3).reverse(), [comments]);

  const generateDraftMutation = useMutation({
    mutationFn: async (payload: DraftGenerationPayload) => {
      return api.post("/v1/drafts", {
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      // Refresh the request details to show updated status
      queryClient.invalidateQueries({ queryKey: ["requests", requestId, "detail"] });
      // Clear the form
      setDraftText("");
    },
  });

  const canGenerateDraft = role === "writer" && 
                          detail?.assigned_writer_id === userId && 
                          detail?.status === "drafting";

  const handleGenerateDraft = () => {
    if (!draftText.trim()) {
      alert("Please enter text to generate a draft");
      return;
    }
    
    generateDraftMutation.mutate({
      request_id: requestId,
      text: draftText,
      source_language: sourceLanguage,
      target_language: targetLanguage,
      num_candidates: 1,
      use_rag: true,
    });
  };

  const detailErrorMessage = detailError?.message ?? "Unable to load request.";
  const commentsErrorMessage = commentsError?.message ?? "Unable to load comments.";

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Request</p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {detail ? detail.title : isLoadingDetail ? "Loading…" : "Request not found"}
          </h1>
          {detail && (
            <p className="text-sm text-slate-600">
              Feature {detail.feature_name} · Created {formatDate(detail.created_at)}
            </p>
          )}
        </div>
        <Link href="/requests" className="text-sm text-primary-600 hover:text-primary-500">
          Back to queue
        </Link>
      </header>

      {isDetailError && !isLoadingDetail && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {detailErrorMessage}
        </div>
      )}

      {detail && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span
              className={clsx(
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                statusColors[detail.status] ?? "bg-slate-100 text-slate-700"
              )}
            >
              {formatStatus(detail.status)}
            </span>
            {detail.assigned_writer_id && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                Assigned to {detail.assigned_writer_id}
              </span>
            )}
            <span className="text-xs text-slate-500">Last updated {formatDate(detail.updated_at)}</span>
          </div>

          {canGenerateDraft && (
            <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-blue-900">Generate AI Draft</h2>
              <div className="mt-3 space-y-3">
                <div>
                  <label htmlFor="draft-text" className="block text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Text to translate
                  </label>
                  <textarea
                    id="draft-text"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-blue-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={3}
                    placeholder="Enter Korean text to generate English draft..."
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <label htmlFor="source-lang" className="block text-xs font-semibold uppercase tracking-wide text-blue-700">
                      From
                    </label>
                    <select
                      id="source-lang"
                      value={sourceLanguage}
                      onChange={(e) => setSourceLanguage(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-blue-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ko">Korean</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="target-lang" className="block text-xs font-semibold uppercase tracking-wide text-blue-700">
                      To
                    </label>
                    <select
                      id="target-lang"
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-blue-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="en">English</option>
                      <option value="ko">Korean</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleGenerateDraft}
                      disabled={generateDraftMutation.isPending || !draftText.trim()}
                      className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                      {generateDraftMutation.isPending ? "Generating..." : "Generate Draft"}
                    </button>
                  </div>
                </div>
                {generateDraftMutation.isError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    Error: {generateDraftMutation.error?.message ?? "Failed to generate draft"}
                  </div>
                )}
                {generateDraftMutation.isSuccess && (
                  <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                    Draft generated successfully! Status updated to "In Review".
                  </div>
                )}
              </div>
            </section>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Draft progress</h2>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{detail.draft_count}</p>
              <p className="mt-2 text-sm text-slate-600">
                {detail.draft_count === 0
                  ? "No drafts submitted yet."
                  : detail.draft_count === 1
                  ? "One draft available for review."
                  : `${detail.draft_count} drafts captured to date.`}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Approval status</h2>
              <p className="mt-3 text-lg font-semibold text-slate-900">{formatStatus(detail.status)}</p>
              <p className="mt-2 text-sm text-slate-600">
                {detail.status === "approved"
                  ? "Approved and ready for export."
                  : detail.status === "rejected"
                  ? "Latest approval decision rejected the request."
                  : "Awaiting approval decision."}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Comment summary</h2>
              {isLoadingComments && <p className="mt-3 text-sm text-slate-500">Loading comments…</p>}
              {isCommentsError && !isLoadingComments && (
                <p className="mt-3 text-sm text-red-600">{commentsErrorMessage}</p>
              )}
              {!isLoadingComments && !isCommentsError && (
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-900">{openComments.length}</span> open
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">{resolvedComments.length}</span> resolved
                  </p>
                </div>
              )}
            </article>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Context</h2>
              <div className="mt-3 space-y-3 text-sm text-slate-700">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</h3>
                  <p className="mt-1 text-slate-700">
                    {detail.context_description && detail.context_description.trim().length > 0
                      ? detail.context_description
                      : "No additional context provided."}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tone</h3>
                    <p className="mt-1 text-slate-700">{detail.tone?.trim() || "—"}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Style</h3>
                    <p className="mt-1 text-slate-700">{detail.style_preferences?.trim() || "—"}</p>
                  </div>
                </div>
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Constraints</h2>
              {detail.constraints_json && Object.keys(detail.constraints_json).length > 0 ? (
                <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {Object.entries(detail.constraints_json).map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-slate-50 px-3 py-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key}</dt>
                      <dd className="mt-1 text-slate-700">{formatConstraintValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-3 text-sm text-slate-600">No constraints provided.</p>
              )}
            </section>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Recent comments</h2>
              {comments.length > 3 && (
                <span className="text-xs text-slate-500">Showing latest {latestComments.length} of {comments.length}</span>
              )}
            </div>
            {isLoadingComments && <p className="text-sm text-slate-500">Loading comments…</p>}
            {isCommentsError && !isLoadingComments && (
              <p className="text-sm text-red-600">{commentsErrorMessage}</p>
            )}
            {!isLoadingComments && !isCommentsError && comments.length === 0 && (
              <p className="text-sm text-slate-600">No comments yet.</p>
            )}
            {!isLoadingComments && !isCommentsError && latestComments.length > 0 && (
              <ul className="space-y-3">
                {latestComments.map((comment) => (
                  <li key={comment.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-semibold uppercase tracking-wide">{comment.author_id}</span>
                      <span>{formatDate(comment.created_at)}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-700">{comment.body}</p>
                    <span
                      className={clsx(
                        "mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                        comment.status === "resolved"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-800"
                      )}
                    >
                      {comment.status === "resolved" ? "Resolved" : "Open"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
