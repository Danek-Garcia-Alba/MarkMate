import {
  BookOpen,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Plus,
  Settings,
} from "lucide-react";
import { useCourseStore } from "../desktop/DesktopApp";

const mobileTabs = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Courses", icon: BookOpen },
  { label: "GPA", icon: Gauge },
  { label: "Settings", icon: Settings },
] as const;

export default function MobileApp() {
  const courses = useCourseStore((state) => state.courses);
  const appMode = useCourseStore((state) => state.appMode ?? "custom");
  const universityThemeId = useCourseStore(
    (state) => state.universityThemeId ?? "uoft"
  );

  return (
    <div
      className="app-shell min-h-[100dvh] bg-slate-50 text-slate-950"
      data-app-mode={appMode}
      data-theme-id={universityThemeId}
    >
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-28 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <header className="rounded-2xl border border-white/60 bg-white/82 p-4 shadow-soft backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                MarkMate mobile
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">
                Phone layout starts here.
              </h1>
            </div>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
              <GraduationCap className="h-6 w-6" />
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-3xl border border-white/60 bg-white/88 p-5 shadow-soft backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Placeholder shell
              </p>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                Desktop is preserved while the dedicated mobile dashboard,
                courses, GPA, and settings tabs are built in sequence.
              </p>
            </div>
            <span className="rounded-full bg-slate-950 px-3 py-1 text-sm font-bold text-white">
              {courses.length}
            </span>
          </div>
          <button
            type="button"
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-base font-bold text-white shadow-soft active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" />
            Add course
          </button>
        </section>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/60 bg-white/82 px-4 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] pt-2 shadow-[0_-18px_44px_-28px_rgba(15,23,42,0.45)] backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {mobileTabs.map((tab, index) => {
            const Icon = tab.icon;
            const active = index === 0;
            return (
              <button
                key={tab.label}
                type="button"
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition active:scale-[0.98] ${
                  active ? "bg-slate-950 text-white" : "text-slate-500"
                }`}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
