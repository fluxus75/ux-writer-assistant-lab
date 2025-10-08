import type { Metadata } from "next";

import { NewRequestForm } from "./NewRequestForm";

export const metadata: Metadata = {
  title: "New Request · UX Writer Assistant",
  description: "Capture a new UX copy request and assign it to a writer.",
};

export default function NewRequestPage() {
  return <NewRequestForm />;
}
