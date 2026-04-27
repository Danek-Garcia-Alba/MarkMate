# MarkMate

MarkMate is a Vite + React + Tailwind web app for tracking courses, semesters, assignments, grades, and university-specific GPA or average estimates.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand persisted local state
- FullCalendar

## Local Development

```bash
npm install
npm run dev
```

The dev server runs on `http://127.0.0.1:5173`.

## Production Build

```bash
npm run build
```

The production output is written to `dist/`.

## Deployment

This repo is configured for Vercel:

- Framework: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

When connected to Vercel through GitHub, pushes to `main` trigger automatic production redeploys.

## Project Structure

```text
src/
  App.tsx                 Main app shell and UI flows
  index.css               Tailwind entry and app styling
  lib/gpa/                University GPA and average policy engine
public/
  themes/                 University theme backgrounds used by the app
```

The GPA engine is intentionally isolated under `src/lib/gpa/` so future school-policy changes can be made without redesigning the UI.
