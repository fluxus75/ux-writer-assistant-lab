"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ApiError, useApiClient } from "../../../lib/api";

type RequestDetail = {
  id: string;
};

type FormState = {
  title: string;
  featureName: string;
  contextDescription: string;
  tone: string;
  stylePreferences: string;
  constraintDevice: string;
  constraintFeatureNorm: string;
  constraintStyleTag: string;
  assignedWriterId: string;
};

const initialFormState: FormState = {
  title: "",
  featureName: "",
  contextDescription: "",
  tone: "",
  stylePreferences: "",
  constraintDevice: "",
  constraintFeatureNorm: "",
  constraintStyleTag: "",
  assignedWriterId: "",
};

export function NewRequestForm() {
  const api = useApiClient();
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateField = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const title = formState.title.trim();
    const featureName = formState.featureName.trim();

    if (!title || !featureName) {
      setErrorMessage("Title and feature name are required.");
      return;
    }

    const payload: Record<string, unknown> = {
      title,
      feature_name: featureName,
    };

    if (formState.contextDescription.trim()) {
      payload.context_description = formState.contextDescription.trim();
    }
    if (formState.tone.trim()) {
      payload.tone = formState.tone.trim();
    }
    if (formState.stylePreferences.trim()) {
      payload.style_preferences = formState.stylePreferences.trim();
    }
    if (formState.assignedWriterId.trim()) {
      payload.assigned_writer_id = formState.assignedWriterId.trim();
    }

    const constraints: Record<string, string> = {};
    if (formState.constraintDevice.trim()) {
      constraints.device = formState.constraintDevice.trim();
    }
    if (formState.constraintFeatureNorm.trim()) {
      constraints.feature_norm = formState.constraintFeatureNorm.trim();
    }
    if (formState.constraintStyleTag.trim()) {
      constraints.style_tag = formState.constraintStyleTag.trim();
    }
    if (Object.keys(constraints).length > 0) {
      payload.constraints = constraints;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post<RequestDetail>("/v1/requests", {
        body: JSON.stringify(payload),
      });
      router.push(`/requests/${response.id}`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to create request.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Create Request</p>
          <h1 className="text-2xl font-semibold text-slate-900">New UX copy request</h1>
          <p className="text-sm text-slate-600">
            Provide context for the feature and optionally assign a writer to kick off drafting.
          </p>
        </div>
        <Link href="/requests" className="text-sm text-primary-600 hover:text-primary-500">
          Back to queue
        </Link>
      </header>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Title<span className="text-xs font-normal text-slate-500">Required</span>
            <input
              type="text"
              value={formState.title}
              onChange={updateField("title")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="Robot vacuum returns"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Feature name<span className="text-xs font-normal text-slate-500">Required</span>
            <input
              type="text"
              value={formState.featureName}
              onChange={updateField("featureName")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="charging"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
            Context description
            <textarea
              value={formState.contextDescription}
              onChange={updateField("contextDescription")}
              className="min-h-[120px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="Notify the user that the device is returning to its base."
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Tone
            <input
              type="text"
              value={formState.tone}
              onChange={updateField("tone")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="concise"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Style preferences
            <input
              type="text"
              value={formState.stylePreferences}
              onChange={updateField("stylePreferences")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="system.action"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Constraint · device
            <input
              type="text"
              value={formState.constraintDevice}
              onChange={updateField("constraintDevice")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="robot_vacuum"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Constraint · feature norm
            <input
              type="text"
              value={formState.constraintFeatureNorm}
              onChange={updateField("constraintFeatureNorm")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="charging"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Constraint · style tag
            <input
              type="text"
              value={formState.constraintStyleTag}
              onChange={updateField("constraintStyleTag")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="concise.system.action"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Assigned writer ID
            <input
              type="text"
              value={formState.assignedWriterId}
              onChange={updateField("assignedWriterId")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder="writer-1"
            />
          </label>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/requests"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-primary-300"
          >
            {isSubmitting ? "Creating…" : "Create request"}
          </button>
        </div>
      </form>
    </section>
  );
}
