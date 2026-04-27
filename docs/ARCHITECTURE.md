# MarkMate Architecture

MarkMate is currently a Vite + React + TypeScript single-page app.

## Main Areas

- `src/App.tsx` contains the main UI, Zustand store, university mode, semesters, course flows, calendar, and GPA panel wiring.
- `src/lib/gpa/` contains the school-specific GPA and average engine. Keep policy changes here instead of mixing GPA rules into UI components.
- `public/themes/` contains the final university background assets used by the theme selector.
- `src/index.css` contains global app styling, Tailwind layers, calendar polish, theme background treatment, and animation utilities.
- `vercel.json` contains Vercel deployment defaults for the Vite build.

## Change Guidelines

- Keep registrar and grading-policy logic inside `src/lib/gpa/`.
- Keep public image assets under `public/` and reference them with root-relative paths such as `/themes/uoft-theme.png`.
- Prefer adding new feature modules under `src/lib/` or `src/features/` before growing `src/App.tsx` further.
- Run `npm run build` before pushing so Vercel receives a clean deploy.
