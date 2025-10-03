const guardrailChecks = [
  { label: "Glossary compliance", status: "Pass" },
  { label: "Tone & person", status: "Warning" },
  { label: "Length", status: "Pass" }
];

const draftCandidates = [
  {
    id: "draft-a",
    text: "Returning to charging station.",
    novelty: "feature",
    score: 0.81,
  },
  {
    id: "draft-b",
    text: "Docking to recharge battery.",
    novelty: "feature",
    score: 0.76,
  },
  {
    id: "draft-c",
    text: "Battery low. Heading back to base.",
    novelty: "style",
    score: 0.72,
  },
];

export default function WorkspacePage() {
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">REQ-2401</p>
          <h1 className="text-2xl font-semibold text-slate-900">Robot vacuum return flow</h1>
          <p className="text-sm text-slate-600">
            Compare RAG candidates, review guardrail checks, and promote the best draft for approval.
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
        {draftCandidates.map((candidate) => (
          <article key={candidate.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <header className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase">{candidate.id}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {candidate.novelty}
              </span>
            </header>
            <p className="mt-3 text-sm text-slate-800">{candidate.text}</p>
            <footer className="mt-4 text-xs text-slate-500">retrieval score {candidate.score.toFixed(2)}</footer>
          </article>
        ))}
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Guardrail Checks</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {guardrailChecks.map((check) => (
              <li key={check.label} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                <span>{check.label}</span>
                <span className={check.status === "Pass" ? "text-emerald-600" : "text-amber-600"}>{check.status}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">RAG References</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Style example — "Docking for recharge."</li>
            <li>Style example — "Battery is low. Returning to base."</li>
            <li>Glossary — "Dock" ➜ "Return to base"</li>
          </ul>
        </article>
      </section>
    </section>
  );
}
