import Link from "next/link";
import { notFound } from "next/navigation";

type RequestDetail = {
  id: string;
  title: string;
  feature_name: string;
  status: string;
  assigned_writer_id: string | null;
  created_at: string;
  updated_at: string;
  draft_count: number;
  context_description: string | null;
  tone: string | null;
  style_preferences: string | null;
  constraints_json: Record<string, any> | null;
};

async function fetchRequestDetail(id: string): Promise<RequestDetail | null> {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const role = process.env.NEXT_PUBLIC_API_ROLE ?? "designer";
  const userId = process.env.NEXT_PUBLIC_API_USER_ID ?? "designer-1";
  
  try {
    const res = await fetch(`${base}/v1/requests/${id}`, {
      headers: {
        "X-User-Role": role,
        "X-User-Id": userId,
      },
      cache: "no-store",
    });
    
    if (!res.ok) {
      if (res.status === 404) {
        return null;
      }
      throw new Error(`Failed to load request (${res.status})`);
    }
    
    return await res.json();
  } catch (error) {
    console.error("Error fetching request detail:", error);
    return null;
  }
}

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const request = await fetchRequestDetail(params.id);
  
  if (!request) {
    notFound();
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-yellow-50 text-yellow-600";
      case "in_progress":
        return "bg-blue-50 text-blue-600";
      case "completed":
        return "bg-green-50 text-green-600";
      case "approved":
        return "bg-primary-50 text-primary-600";
      default:
        return "bg-slate-50 text-slate-600";
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <nav className="flex items-center text-sm text-slate-500 mb-2">
            <Link href="/requests" className="hover:text-slate-700">
              Requests
            </Link>
            <span className="mx-2">/</span>
            <span className="text-slate-900">{request.id}</span>
          </nav>
          <h1 className="text-2xl font-semibold text-slate-900">{request.title}</h1>
          <p className="text-sm text-slate-600">Request details and management</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/workspace"
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-500"
          >
            Open in Workspace
          </Link>
          <Link
            href="/requests"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Back to Requests
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-slate-600">Feature Name</dt>
                <dd className="mt-1 text-sm text-slate-900">{request.feature_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeColor(request.status)}`}>
                    {request.status.replace("_", " ")}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Assigned Writer</dt>
                <dd className="mt-1 text-sm text-slate-900">{request.assigned_writer_id || "Unassigned"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600">Draft Count</dt>
                <dd className="mt-1 text-sm text-slate-900">{request.draft_count}</dd>
              </div>
            </dl>
          </div>

          {/* Context & Description */}
          {request.context_description && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Context Description</h2>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{request.context_description}</p>
            </div>
          )}

          {/* Style Preferences & Tone */}
          {(request.tone || request.style_preferences) && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Style & Tone</h2>
              <dl className="space-y-4">
                {request.tone && (
                  <div>
                    <dt className="text-sm font-medium text-slate-600">Tone</dt>
                    <dd className="mt-1 text-sm text-slate-900">{request.tone}</dd>
                  </div>
                )}
                {request.style_preferences && (
                  <div>
                    <dt className="text-sm font-medium text-slate-600">Style Preferences</dt>
                    <dd className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{request.style_preferences}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Constraints */}
          {request.constraints_json && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Constraints</h2>
              <div className="bg-slate-50 rounded-md p-4">
                <pre className="text-xs text-slate-700 overflow-x-auto">
                  {JSON.stringify(request.constraints_json, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Metadata</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium text-slate-600">Request ID</dt>
                <dd className="mt-1 text-xs text-slate-900 font-mono">{request.id}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-600">Created</dt>
                <dd className="mt-1 text-xs text-slate-900">{formatDate(request.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-600">Last Updated</dt>
                <dd className="mt-1 text-xs text-slate-900">{formatDate(request.updated_at)}</dd>
              </div>
            </dl>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                href="/workspace"
                className="block w-full rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white text-center hover:bg-primary-500"
              >
                Work on this Request
              </Link>
              <Link
                href="/requests"
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 text-center hover:bg-slate-100"
              >
                Back to All Requests
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}