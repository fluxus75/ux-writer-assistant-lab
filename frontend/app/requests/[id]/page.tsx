import type { Metadata } from "next";

import { RequestDetailView } from "./RequestDetailView";

export const metadata: Metadata = {
  title: "Request Details · UX Writer Assistant",
  description: "Review draft progress, approvals, and feedback for a UX copy request.",
};

export default function RequestDetailPage({ params }: { params: { id: string } }) {
  return <RequestDetailView requestId={params.id} />;
}
