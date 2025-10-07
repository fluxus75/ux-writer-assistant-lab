const jobs = [
  { id: "job-101", format: "CSV", status: "Completed", timestamp: "2024-09-18 14:02" },
  { id: "job-102", format: "Notion", status: "Running", timestamp: "2024-09-18 14:10" }
];

export default function ExportsPage() {
  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Exports</h1>
          <p className="text-sm text-slate-600">Track export jobs and configure delivery targets.</p>
        </div>
        <button className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500">
          New Export
        </button>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Recent Jobs</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-800">{job.format}</p>
                  <p className="text-xs text-slate-500">{job.timestamp}</p>
                </div>
                <span
                  className={
                    job.status === "Completed"
                      ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600"
                      : "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600"
                  }
                >
                  {job.status}
                </span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Destinations</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <label className="flex items-center justify-between">
              <span>CSV Download</span>
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300" />
            </label>
            <label className="flex items-center justify-between">
              <span>Word Template</span>
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
            </label>
            <label className="flex items-center justify-between">
              <span>Notion Sync</span>
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300" />
            </label>
          </div>
        </article>
      </div>
    </section>
  );
}
