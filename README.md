# Orbit

**Orbit** is a lightweight task‑tracking web application built with React, TypeScript, and Vite. It uses Supabase for authentication and persistence, features a clean UI, and allows users to create, edit, prioritize, and archive tasks with optional due dates.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (this repo uses npm but yarn or pnpm can also be used)
- A Supabase project (free tier is sufficient)
- `.env` file at the project root containing:
  ```env
  VITE_SUPABASE_URL=your‑supabase-url
  VITE_SUPABASE_ANON_KEY=your‑anon-key
  ```
  (see `src/lib/supabase.ts` for variable usage)

### Installation

```bash
npm install        # or yarn install / pnpm install
```

### Development

```bash
npm run dev
# open http://localhost:5173
```

### Production Build

```bash
npm run build
npm run preview    # serve the production build locally
```

---

## 🧱 Project Structure

```
src/
  components/
    ui/            # shared UI primitives (Modal, Spinner, StarField, etc.)
    tasks/         # task-specific components (Create/Edit modals, TaskCard)
    auth/          # authentication page
    layout/        # layout helpers (AppLayout, Sidebar)
  contexts/        # AuthContext for user state
  hooks/           # custom hooks (useTasks.ts)
  lib/             # Supabase client, validations
  pages/           # top-level pages (DashboardPage, ArchivePage)
  types/           # generated database typings
```

Key files:

- `src/hooks/useTasks.ts` – core task CRUD logic
- `src/lib/validations.ts` – form validators
- `src/pages/DashboardPage.tsx` – main dashboard & edit modal logic

---

## ✨ Features

- Signup/login with Supabase Auth
- Create tasks with title, description, priority (low/medium/high), due date
- Edit or delete existing tasks
- Archive completed tasks
- Responsive, accessible UI with keyboard support

---

## 🛠 Developer Notes

- ESLint configured for React + TypeScript; run `npm run lint` to check. Formatter is Prettier via ESLint.
- `EditTaskModal` uses a `key` prop from the task ID to reset internal state when switching tasks.
- Global state is minimal; most logic lives in `useTasks` and context.

---

Feel free to extend this README with deployment instructions, screenshots, or contributor guidelines as the project grows.
