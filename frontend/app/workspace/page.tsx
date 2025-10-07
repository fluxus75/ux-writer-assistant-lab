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
};

async function fetchWorkspaceData(): Promise<{ request: RequestSummary | null; references: RetrievalItem[] }> {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const role = process.env.NEXT_PUBLIC_API_ROLE ?? "writer";
  const userId = process.env.NEXT_PUBLIC_API_USER_ID ?? "writer-1";
  const headers = {
    "X-User-Role": role,
    "X-User-Id": userId,
  };
  const listRes = await fetch(`${base}/v1/requests`, { headers, cache: "no-store" });
  if (!listRes.ok) {
    return { request: null, references: [] };
  }
  const listJson = await listRes.json();
  const first = (listJson.items ?? [])[0];
  if (!first) {
    return { request: null, references: [] };
  }
  const detailRes = await fetch(`${base}/v1/requests/${first.id}`, { headers, cache: "no-store" });
  const detailJson = detailRes.ok ? await detailRes.json() : first;
  const filters = detailJson.constraints_json ?? {};
  const retrieveRes = await fetch(`${base}/v1/retrieve`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ query: detailJson.context_description ?? "", filters, topK: 3 }),
    cache: "no-store",
  });
  const retrieveJson = retrieveRes.ok ? await retrieveRes.json() : { items: [] };
  return { request: detailJson as RequestSummary, references: retrieveJson.items ?? [] };
}

export default async function WorkspacePage() {
  const { request, references } = await fetchWorkspaceData();
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
            {references.slice(0, 3).map((item) => (
              <li key={item.sid}>{item.en_line}</li>
            ))}
            {references.length === 0 && <li>No references yet.</li>}
          </ul>
        </article>
      </section>
    </section>
  );
}
