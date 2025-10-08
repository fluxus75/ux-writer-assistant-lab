"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { ApiError, useApiClient } from "../../lib/api";

type RequestRow = {
  id: string;
  title: string;
  feature_name: string;
  status: string;
  assigned_writer_id: string | null;
  created_at: string;
};

type RequestsResponse = {
  items?: RequestRow[];
};

const columns = [
  { key: "title", label: "Title" },
  { key: "feature_name", label: "Feature" },
  { key: "status", label: "Status" },
  { key: "assigned_writer_id", label: "Writer" }
];

export default function RequestsPage() {
  const api = useApiClient();

  const { data, isLoading, isError, error } = useQuery<RequestRow[], ApiError>({
    queryKey: ["requests", "list"],
    queryFn: async () => {
      const response = await api.get<RequestsResponse>("/v1/requests");
      return response.items ?? [];
    },
  });

  const rows = data ?? [];
  const errorMessage = error?.message ?? "Unable to load requests.";

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
        {isLoading && (
          <div className="px-4 py-6 text-sm text-slate-500">Loading requests…</div>
        )}
        {isError && !isLoading && (
          <div className="px-4 py-6 text-sm text-red-600">{errorMessage}</div>
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <div className="px-4 py-6 text-sm text-slate-500">No requests have been created yet.</div>
        )}
        {!isLoading && !isError && rows.length > 0 && (
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
        )}
      </div>
    </section>
  );
}
