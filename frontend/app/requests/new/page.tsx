"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RequestFormData = {
  title: string;
  feature_name: string;
  context_description: string;
  constraints: string;
  assigned_writer_id: string;
};

export default function NewRequestPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<RequestFormData>({
    title: "",
    feature_name: "",
    context_description: "",
    constraints: "",
    assigned_writer_id: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
      const role = process.env.NEXT_PUBLIC_API_ROLE ?? "designer";
      const userId = process.env.NEXT_PUBLIC_API_USER_ID ?? "designer-1";

      let constraints = null;
      if (formData.constraints.trim()) {
        try {
          constraints = JSON.parse(formData.constraints);
        } catch {
          setError("Constraints must be valid JSON format");
          return;
        }
      }

      const payload = {
        title: formData.title,
        feature_name: formData.feature_name,
        context_description: formData.context_description || null,
        constraints: constraints,
        assigned_writer_id: formData.assigned_writer_id || null,
      };

      const response = await fetch(`${base}/v1/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Role": role,
          "X-User-Id": userId,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      router.push("/requests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">New Request</h1>
          <p className="text-sm text-slate-600">Create a new UX copy request for the team.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/requests")}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              value={formData.title}
              onChange={handleInputChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="e.g., Robot vacuum returns to charging dock"
            />
          </div>

          <div>
            <label htmlFor="feature_name" className="block text-sm font-medium text-slate-700 mb-2">
              Feature Name *
            </label>
            <input
              type="text"
              id="feature_name"
              name="feature_name"
              required
              value={formData.feature_name}
              onChange={handleInputChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="e.g., charging"
            />
          </div>

          <div>
            <label htmlFor="context_description" className="block text-sm font-medium text-slate-700 mb-2">
              Context Description
            </label>
            <textarea
              id="context_description"
              name="context_description"
              rows={3}
              value={formData.context_description}
              onChange={handleInputChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Describe the context and requirements for this copy request..."
            />
          </div>

          <div>
            <label htmlFor="constraints" className="block text-sm font-medium text-slate-700 mb-2">
              Constraints (JSON format)
            </label>
            <textarea
              id="constraints"
              name="constraints"
              rows={3}
              value={formData.constraints}
              onChange={handleInputChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder='{"device": "robot_vacuum", "feature_norm": "charging"}'
            />
            <p className="mt-1 text-xs text-slate-500">
              Optional. Enter constraints as JSON for filtering during retrieval.
            </p>
          </div>

          <div>
            <label htmlFor="assigned_writer_id" className="block text-sm font-medium text-slate-700 mb-2">
              Assigned Writer ID
            </label>
            <input
              type="text"
              id="assigned_writer_id"
              name="assigned_writer_id"
              value={formData.assigned_writer_id}
              onChange={handleInputChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="e.g., writer-1"
            />
            <p className="mt-1 text-xs text-slate-500">
              Optional. Assign this request to a specific writer.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create Request"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/requests")}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}