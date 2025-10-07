import Link from "next/link";

type RequestRow = {
  id: string;
  title: string;
  feature_name: string;
  status: string;
  assigned_writer_id: string | null;
  created_at: string;
};

const columns = [
  { key: "title", label: "Title" },
  { key: "feature_name", label: "Feature" },
  { key: "status", label: "Status" },
  { key: "assigned_writer_id", label: "Writer" }
];

async function fetchRequests(): Promise<RequestRow[]> {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const role = process.env.NEXT_PUBLIC_API_ROLE ?? "designer";
  const userId = process.env.NEXT_PUBLIC_API_USER_ID ?? "designer-1";
  const res = await fetch(`${base}/v1/requests`, {
    headers: {
      "X-User-Role": role,
      "X-User-Id": userId,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load requests (${res.status})`);
  }
  const data = await res.json();
  return (data.items ?? []) as RequestRow[];
}

export default async function RequestsPage() {
  const rows = await fetchRequests();
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
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/requests/${row.id}`} className="text-primary-600">
                    {row.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.feature_name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.assigned_writer_id ?? "Unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
