# UX Writer Assistant — Next.js Workspace Shell

Day 3 introduces the production frontend scaffold that complements the FastAPI backend. The goal is to create a Next.js 14 App Router
workspace where designers and writers can explore the upcoming workflow screens before hooking them to live APIs.

## Features
- **App shell** with persistent navigation for Overview, Requests, Workspace, and Exports.
- **Requests list** to visualize assignment/status states.
- **Writer workspace** mockups showing RAG candidates, guardrail checks, and references.
- **Exports dashboard** summarizing recent jobs and destination toggles.
- Tailwind-based design tokens aligned with Day 2 color/typography guidelines.

## Getting Started
```bash
cd frontend
pnpm install  # or npm install / yarn
pnpm dev      # runs Next.js dev server on http://localhost:3000
```

Environment variables are loaded from `.env.local`. Set `NEXT_PUBLIC_API_BASE` to the FastAPI origin (e.g. `http://localhost:8000`) when the
API contracts become available.

## Directory Structure
```
frontend/
  app/
    layout.tsx      # wraps pages with the shared AppShell
    page.tsx        # overview timeline
    requests/       # request list screen
    workspace/      # writer workspace mock view
    exports/        # export configuration view
  components/
    AppShell.tsx    # nav + header layout
  styles/
    globals.css     # Tailwind + global styles
  tailwind.config.ts
  tsconfig.json
```

## Next Steps
- Wire `@tanstack/react-query` to `/v1/requests` once the backend endpoint lands.
- Add request creation and draft editing forms with form validation (React Hook Form).
- Integrate session-aware role switching after RBAC middleware ships.
