import Link from "next/link";

const columns = [
  { key: "title", label: "Title" },
  { key: "feature", label: "Feature" },
  { key: "status", label: "Status" },
  { key: "writer", label: "Writer" }
];

const mockRows = [
  {
    id: "REQ-2401",
    title: "Robot vacuum return flow",
    feature: "Docking",
    status: "In Review",
    writer: "Minseo",
  },
  {
    id: "REQ-2402",
    title: "Washer rinse confirmation",
    feature: "Cleaning",
    status: "Drafting",
    writer: "In Progress",
  },
];

export default function RequestsPage() {
  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Requests</h1>
          <p className="text-sm text-slate-600">View incoming UX copy requests and assign writers.</p>
        </div>
        <Link
          href="/requests/new"
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-500"
        >
          New Request
        </Link>
      </header>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left font-semibold text-slate-600">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mockRows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/requests/${row.id}`} className="text-primary-600">
                    {row.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.feature}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.writer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
