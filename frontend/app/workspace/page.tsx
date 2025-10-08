"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { ApiError, useApiClient } from "../../lib/api";

type RetrievalItem = {
  sid: string;
  en_line: string;
  score: number;
  metadata: Record<string, string | null>;
};

type RequestSummary = {
  id: string;
  title: string;
  feature_name: string;
  status: string;
  constraints_json?: Record<string, string>;
  context_description?: string;
};

type RequestsListResponse = {
  items?: RequestSummary[];
};

type RetrievalResponse = {
  items?: RetrievalItem[];
};

type WorkspaceData = {
  request: RequestSummary | null;
  references: RetrievalItem[];
  warnings: string[];
};

const emptyWorkspace: WorkspaceData = {
  request: null,
  references: [],
  warnings: [],
};

export default function WorkspacePage() {
  const api = useApiClient();

  const { data, isLoading, isError, error } = useQuery<WorkspaceData, ApiError>({
    queryKey: ["workspace", "current"],
    queryFn: async () => {
      const warnings: string[] = [];
      const listResponse = await api.get<RequestsListResponse>("/v1/requests");
      const first = listResponse.items?.[0];
      if (!first) {
        return { request: null, references: [], warnings: [] };
      }

      let requestDetail: RequestSummary = first;
      try {
        requestDetail = await api.get<RequestSummary>(`/v1/requests/${first.id}`);
      } catch (detailError) {
        const message = detailError instanceof ApiError ? detailError.message : "Failed to load request details.";
        warnings.push(message);
      }

      let references: RetrievalItem[] = [];
      try {
        const payload = {
          query: requestDetail.context_description ?? "",
          filters: requestDetail.constraints_json ?? {},
          topK: 3,
        };
        const retrievalResponse = await api.post<RetrievalResponse>("/v1/retrieve", {
          body: JSON.stringify(payload),
        });
        references = retrievalResponse.items ?? [];
      } catch (retrieveError) {
        const message =
          retrieveError instanceof ApiError ? retrieveError.message : "Failed to load retrieval candidates.";
        warnings.push(message);
      }

      return {
        request: requestDetail,
        references,
        warnings,
      };
    },
  });

  const workspace = data ?? emptyWorkspace;
  const topWarning = useMemo(() => workspace.warnings[0], [workspace.warnings]);
  const errorMessage = error?.message ?? "Unable to load workspace.";

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
            {workspace.request ? workspace.request.id : "No request loaded"}
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {workspace.request ? workspace.request.title : "Select a request"}
          </h1>
          <p className="text-sm text-slate-600">
            Compare references from the retrieval API and promote the best draft for approval.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Save Draft
          </button>
          <button className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500">
            Send for Approval
          </button>
        </div>
      </header>

      {isLoading && <div className="rounded-md border border-dashed border-slate-300 bg-white/50 p-4 text-sm text-slate-500">Loading workspace…</div>}
      {isError && !isLoading && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
      )}
      {!isLoading && !isError && topWarning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{topWarning}</div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {workspace.references.length === 0 && !isLoading && !isError && (
          <p className="col-span-3 text-sm text-slate-500">
            No retrieval candidates available. Trigger ingest to seed data.
          </p>
        )}
        {workspace.references.map((item) => (
          <article key={item.sid} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <header className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase">{item.sid}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {(item.metadata?.feature_norm as string | undefined) ?? "feature"}
              </span>
            </header>
            <p className="mt-3 text-sm text-slate-800">{item.en_line}</p>
            <footer className="mt-4 text-xs text-slate-500">score {item.score.toFixed(2)}</footer>
          </article>
        ))}
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Guardrail Checks</h2>
          <p className="mt-3 text-sm text-slate-600">
            Guardrail summaries will appear here after draft generation. Use the draft API to create new versions.
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">RAG References</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {workspace.references.slice(0, 3).map((item) => (
              <li key={item.sid}>{item.en_line}</li>
            ))}
            {workspace.references.length === 0 && <li>No references yet.</li>}
          </ul>
        </article>
      </section>
    </section>
  );
}
