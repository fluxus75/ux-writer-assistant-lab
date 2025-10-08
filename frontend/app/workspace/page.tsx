"use client";

import { useState, useEffect } from "react";

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

type DraftVersion = {
  id: string;
  version_index: number;
  content: string;
  metadata_json?: any;
  created_at: string;
};

type Draft = {
  id: string;
  request_id: string;
  versions: DraftVersion[];
  request_status: string;
};

export default function WorkspacePage() {
  const [request, setRequest] = useState<RequestSummary | null>(null);
  const [references, setReferences] = useState<RetrievalItem[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const role = process.env.NEXT_PUBLIC_API_ROLE ?? "writer";
  const isWriter = role === "writer";
  const isDesigner = role === "designer";

  const fetchWorkspaceData = async () => {
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
      const headers = {
        "X-User-Role": role,
        "X-User-Id": role === "writer" ? "writer-1" : "designer-1",
      };
      
      const listRes = await fetch(`${base}/v1/requests`, { headers, cache: "no-store" });
      if (!listRes.ok) {
        setRequest(null);
        setReferences([]);
        return;
      }
      
      const listJson = await listRes.json();
      const first = (listJson.items ?? [])[0];
      if (!first) {
        setRequest(null);
        setReferences([]);
        return;
      }
      
      const detailRes = await fetch(`${base}/v1/requests/${first.id}`, { headers, cache: "no-store" });
      const detailJson = detailRes.ok ? await detailRes.json() : first;
      setRequest(detailJson as RequestSummary);
      
      const filters = detailJson.constraints_json ?? {};
      const retrieveRes = await fetch(`${base}/v1/retrieve`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ query: detailJson.context_description ?? "", filters, topK: 3 }),
        cache: "no-store",
      });
      const retrieveJson = retrieveRes.ok ? await retrieveRes.json() : { items: [] };
      setReferences(retrieveJson.items ?? []);
    } catch (err) {
      console.error("Error fetching workspace data:", err);
      setError(err instanceof Error ? err.message : "Failed to load workspace data");
    } finally {
      setLoading(false);
    }
  };

  const generateDraft = async () => {
    if (!request) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
      const headers = {
        "X-User-Role": role,
        "X-User-Id": role === "writer" ? "writer-1" : "designer-1",
        "Content-Type": "application/json",
      };
      
      const payload = {
        request_id: request.id,
        text: request.context_description || request.title || "Generate UX copy for robot vacuum charging feature",
        source_language: "en",
        target_language: "en",
        hints: {
          feature: request.feature_name,
          context: "UX copy generation",
          variations: "Generate different phrasings and approaches"
        },
        num_candidates: 3,
        use_rag: true,
        rag_top_k: 5,
        temperature: 0.7,
      };
      
      const response = await fetch(`${base}/v1/drafts`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      
      const draft = await response.json();
      setDrafts(prev => [draft, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate draft");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
  }, []);

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-slate-500">Loading workspace...</div>
        </div>
      </section>
    );
  }
  
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">
            {request ? request.id : "No request loaded"}
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {request ? request.title : "Select a request"}
          </h1>
          <p className="text-sm text-slate-600">
            {isWriter 
              ? "Generate AI drafts using RAG references and style guidelines."
              : "Compare references from the retrieval API and promote the best draft for approval."
            }
          </p>
        </div>
        <div className="flex gap-2">
          {isWriter && (
            <button 
              onClick={generateDraft}
              disabled={isGenerating || !request}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? "Generating..." : "Generate AI Draft"}
            </button>
          )}
          {isDesigner && (
            <>
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
                Save Draft
              </button>
              <button className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500">
                Send for Approval
              </button>
            </>
          )}
        </div>
      </header>
      
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      {drafts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Generated Drafts</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {drafts.map((draft) =>
              draft.versions.map((version) => (
                <article key={version.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <header className="flex items-center justify-between text-xs text-slate-500 mb-3">
                    <span className="font-semibold uppercase">Version {version.version_index}</span>
                    <div className="flex gap-1">
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-600">
                        Generated
                      </span>
                      {version.metadata_json?.guardrail && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-600">
                          Checked
                        </span>
                      )}
                    </div>
                  </header>
                  <p className="text-sm text-slate-800 leading-relaxed">{version.content}</p>
                  <footer className="mt-3 space-y-1">
                    {version.metadata_json && (
                      <>
                        <div className="text-xs text-slate-500">
                          Score: {version.metadata_json.score?.toFixed(2) || 
                                  version.metadata_json.quality_score?.toFixed(2) || 
                                  "N/A"}
                        </div>
                        {version.metadata_json.original_text && version.metadata_json.original_text !== version.content && (
                          <div className="text-xs text-amber-600">
                            ⚠️ Auto-corrected by guardrails
                          </div>
                        )}
                        {version.metadata_json.guardrail && (
                          <div className="text-xs text-blue-600">
                            ✓ Guardrail checks passed
                          </div>
                        )}
                      </>
                    )}
                  </footer>
                </article>
              ))
            )}
          </div>
        </div>
      )}
      
      <div className="grid gap-4 md:grid-cols-3">
        {references.length === 0 && (
          <p className="col-span-3 text-sm text-slate-500">No retrieval candidates available. Trigger ingest to seed data.</p>
        )}
        {references.map((item) => (
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
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Guardrail Checks</h2>
          {drafts.length > 0 ? (
            <div className="mt-3 space-y-2">
              {drafts.flatMap(draft => draft.versions).map((version) => (
                <div key={version.id} className="text-xs">
                  <div className="font-medium text-slate-700">Version {version.version_index}:</div>
                  {version.metadata_json?.guardrail ? (
                    <div className="text-green-600">✓ All checks passed</div>
                  ) : version.metadata_json?.original_text && version.metadata_json.original_text !== version.content ? (
                    <div className="text-amber-600">⚠️ Auto-corrected</div>
                  ) : (
                    <div className="text-slate-500">No guardrail data</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Guardrail summaries will appear here after draft generation. Use the draft API to create new versions.
            </p>
          )}
        </article>
        
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">RAG References</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {references.slice(0, 3).map((item) => (
              <li key={item.sid}>{item.en_line}</li>
            ))}
            {references.length === 0 && <li>No references yet.</li>}
          </ul>
        </article>
        
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Comments</h2>
          <div className="mt-3 space-y-3">
            <div className="text-xs text-slate-500">
              <div className="font-medium">Writer-1</div>
              <div className="text-slate-400">2 minutes ago</div>
              <div className="mt-1 text-slate-600">charging dock이 charging station보다 더 적절할 것 같습니다</div>
            </div>
            
            <div className="pt-3 border-t border-slate-100">
              <textarea 
                placeholder="Add a comment..."
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 resize-none"
                rows={2}
              />
              <button className="mt-2 px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-500">
                Submit
              </button>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}
