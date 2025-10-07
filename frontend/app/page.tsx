import Link from "next/link";

const timeline = [
  {
    day: "Day 1",
    title: "Architecture Review",
    detail: "Defined backend workflow entities, RAG collections, and IA foundations.",
  },
  {
    day: "Day 2",
    title: "Persistence Scaffold",
    detail: "Added SQLAlchemy models, session utilities, and RAG config for bge-m3.",
  },
  {
    day: "Day 3",
    title: "Dev Environment Ready",
    detail: "Docker-based Postgres/Qdrant, ONNX-ready embeddings, and workspace shell.",
  },
];

export default function OverviewPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Team Timeline</h1>
        <p className="text-sm text-slate-600">
          Track the 10-day execution plan and jump into each workspace track from here.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {timeline.map((item) => (
          <article key={item.day} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">{item.day}</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
            <div className="mt-4 flex items-center gap-3 text-sm">
              <Link href="/requests" className="font-medium text-primary-600">
                Open Requests
              </Link>
              <Link href="/workspace" className="text-slate-500 hover:text-slate-700">
                Writer Workspace
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
