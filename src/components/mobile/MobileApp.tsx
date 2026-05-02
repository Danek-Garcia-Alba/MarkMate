import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CopyPlus,
  Edit3,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  ListPlus,
  ListChecks,
  Plus,
  Search,
  Settings,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import {
  GPA_POLICY_EXPLANATIONS,
  averageDetail,
  buildCourseGradeRecords,
  calcMetrics,
  calculatePassPlan,
  courseChronology,
  folderDisplayName,
  formatCredits,
  formatGradeRange,
  formatScaleValue,
  formatSchoolAverage,
  getActiveTheme,
  getMarkMateBrandPalette,
  gpaSessionRows,
  gpaWaitingCourseCount,
  gpaYearRows,
  normalizeWeightToPercent,
  parseFlexibleNumber,
  parseGradeInput,
  selectedUniversityId,
  smartSearchMatch,
  useCourseStore,
  type Assignment,
  type AssignmentStatus,
  type Course,
  type CourseFolder,
} from "../desktop/DesktopApp";
import { MarkMateLogo } from "../MarkMateLogo";
import {
  calculateUniversityReport,
  formatAverage,
  type GradeMode,
  type UniversityGpaReport,
} from "../../lib/gpa";

type MobileTab = "dashboard" | "courses" | "calendar" | "gpa" | "settings";

const mobileTabs: Array<{
  id: MobileTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "gpa", label: "GPA", icon: Gauge },
  { id: "settings", label: "Settings", icon: Settings },
];

const universityOptions = [
  { id: "uoft", label: "U of T" },
  { id: "western", label: "Western" },
  { id: "queens", label: "Queen's" },
  { id: "york", label: "York" },
  { id: "tmu", label: "TMU" },
  { id: "waterloo", label: "Waterloo" },
  { id: "laurier", label: "Laurier" },
  { id: "brock", label: "Brock" },
  { id: "guelph", label: "Guelph" },
  { id: "uottawa", label: "uOttawa" },
  { id: "mcgill", label: "McGill" },
] as const;

const customThemeOptions = [
  { id: "classic", label: "Studio Slate" },
  { id: "aurora", label: "Mint Slate" },
  { id: "neon", label: "Blue Lab" },
  { id: "paper", label: "Paper Desk" },
  { id: "sunset", label: "Rose Glass" },
  { id: "midnight", label: "Night Focus" },
  { id: "bloom", label: "Bloom" },
  { id: "circuit", label: "Circuit" },
  { id: "meadow", label: "Meadow" },
] as const;

const gradeModeOptions: Array<{ id: GradeMode; label: string }> = [
  { id: "graded", label: "Graded" },
  { id: "pass-fail", label: "Pass / Fail" },
  { id: "credit-no-credit", label: "CR / NCR" },
  { id: "audit", label: "Audit" },
];

const statusOptions: Array<{ id: AssignmentStatus; label: string }> = [
  { id: "not_started", label: "Not started" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "overdue", label: "Overdue" },
];

const semesterYears = ["Year 1", "Year 2", "Year 3", "Year 4"] as const;
const semesterTerms = ["Fall", "Winter", "Summer"] as const;
const semesterColors = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#be123c",
  "#c2410c",
  "#4d7c0f",
  "#0369a1",
  "#52525b",
] as const;

function campusBubblePosition(themeId: string) {
  if (themeId === "uoft") return "78% 44%";
  return "76% center";
}

function folderSort(a: CourseFolder, b: CourseFolder) {
  const yearA = semesterYears.indexOf(a.year as (typeof semesterYears)[number]);
  const yearB = semesterYears.indexOf(b.year as (typeof semesterYears)[number]);
  if (yearA !== yearB) {
    return (yearA === -1 ? 99 : yearA) - (yearB === -1 ? 99 : yearB);
  }
  const termA = semesterTerms.indexOf(a.name as (typeof semesterTerms)[number]);
  const termB = semesterTerms.indexOf(b.name as (typeof semesterTerms)[number]);
  if (termA !== termB) {
    return (termA === -1 ? 99 : termA) - (termB === -1 ? 99 : termB);
  }
  return folderDisplayName(a).localeCompare(folderDisplayName(b), undefined, {
    numeric: true,
  });
}

function mobileId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeMobileDateInput(value: string): string | null {
  const v = value.trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const slash = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}`;
    }
  }

  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) return toIsoDate(parsed);
  return null;
}

const mobileMonths = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function datePartsFromMobileValue(value: string) {
  const normalized = normalizeMobileDateInput(value);
  const now = new Date();
  if (normalized) {
    const [year, month, day] = normalized.split("-").map(Number);
    return { year, month, day };
  }
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function toMobileIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function formatMobileDateChip(value: string) {
  const normalized = normalizeMobileDateInput(value);
  if (!normalized) return value.trim() || "Date";
  const [, month, day] = normalized.split("-").map(Number);
  return `${month}/${day}`;
}

function blurMobileInputOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") {
    event.currentTarget.blur();
  }
}

function settleMobileInputAfterBlur() {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    window.scrollTo({ top: window.scrollY, left: 0, behavior: "instant" });
  }, 40);
}

function isInteractiveSwipeTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input, textarea, select, button, a, [role='button']")
  );
}

function useHorizontalSwipeExit(onExit: () => void, enabled = true) {
  const startRef = useRef<{ x: number; y: number; active: boolean } | null>(null);

  return {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || isInteractiveSwipeTarget(event.target)) return;
      startRef.current = {
        x: event.clientX,
        y: event.clientY,
        active: true,
      };
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      const start = startRef.current;
      startRef.current = null;
      if (!enabled || !start?.active) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy) * 1.45) {
        onExit();
      }
    },
    onPointerCancel: () => {
      startRef.current = null;
    },
  };
}

function useHorizontalSwipeNavigation(
  onNext: () => void,
  onPrevious: () => void,
  enabled = true
) {
  const startRef = useRef<{ x: number; y: number; active: boolean } | null>(null);

  return {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || isInteractiveSwipeTarget(event.target)) return;
      startRef.current = {
        x: event.clientX,
        y: event.clientY,
        active: true,
      };
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      const start = startRef.current;
      startRef.current = null;
      if (!enabled || !start?.active) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) <= 72 || Math.abs(dx) <= Math.abs(dy) * 1.45) return;
      if (dx > 0) {
        onNext();
      } else {
        onPrevious();
      }
    },
    onPointerCancel: () => {
      startRef.current = null;
    },
  };
}

function schoolLogoSrc(themeId: string) {
  const logos: Record<string, string> = {
    uoft: "/logos/uoft-logo.png",
    western: "/logos/western-logo.png",
    queens: "/logos/queens-logo.png",
    york: "/logos/york-logo.png",
    tmu: "/logos/tmu-logo.png",
    waterloo: "/logos/waterloo-logo.png",
    laurier: "/logos/laurier-logo.png",
    brock: "/logos/brock-logo.png",
    guelph: "/logos/guelph-logo.png",
    uottawa: "/logos/uottawa-logo.png",
    mcgill: "/logos/mcgill-logo.png",
  };
  return logos[themeId] ?? "";
}

function schoolLogoScale(themeId: string) {
  const scales: Record<string, number> = {
    uoft: 1.16,
    western: 1.28,
    york: 1.18,
    waterloo: 1.22,
    laurier: 1.18,
    guelph: 1.16,
    tmu: 1,
    uottawa: 1.04,
  };
  return scales[themeId] ?? 1.04;
}

function customSlatePreview(themeId: string) {
  const previews: Record<
    string,
    { primary: string; accent: string; wash: string }
  > = {
    classic: { primary: "#0f172a", accent: "#34d399", wash: "#f8fafc" },
    aurora: { primary: "#172033", accent: "#2dd4bf", wash: "#f0fdfa" },
    neon: { primary: "#1e3a8a", accent: "#38bdf8", wash: "#eff6ff" },
    paper: { primary: "#1f2933", accent: "#16a34a", wash: "#fffbeb" },
    sunset: { primary: "#be123c", accent: "#fb7185", wash: "#fff1f2" },
    midnight: { primary: "#020617", accent: "#f59e0b", wash: "#f8fafc" },
    bloom: { primary: "#be123c", accent: "#0f766e", wash: "#fff7fa" },
    circuit: { primary: "#1d4ed8", accent: "#475569", wash: "#f4f8ff" },
    meadow: { primary: "#166534", accent: "#b45309", wash: "#f6fcf7" },
  };
  return previews[themeId] ?? previews.classic;
}

function useGpaReport() {
  const courses = useCourseStore((state) => state.courses);
  const folders = useCourseStore((state) => state.folders);
  const universityThemeId = useCourseStore(
    (state) => state.universityThemeId ?? "uoft"
  );

  const foldersById = useMemo(
    () =>
      new Map<string, CourseFolder>(
        folders.map((folder) => [folder.id, folder])
      ),
    [folders]
  );
  const universityId = selectedUniversityId(universityThemeId);
  const gpaRecords = useMemo(
    () => buildCourseGradeRecords(courses, foldersById, universityId),
    [courses, foldersById, universityId]
  );

  return useMemo(
    () => calculateUniversityReport(gpaRecords, universityId),
    [gpaRecords, universityId]
  );
}

function folderLabel(course: Course, folders: CourseFolder[]) {
  if (!course.folderId) return "Unfiled";
  const folder = folders.find((item) => item.id === course.folderId);
  if (!folder) return "Unfiled";
  return folderDisplayName(folder);
}

function compactFolderLabel(folder: CourseFolder) {
  const compactYear = folder.year?.replace(/^Year\s+/i, "Y");
  return compactYear ? `${compactYear} ${folder.name}` : folder.name;
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${Number(value.toFixed(1)).toString()}%`;
}

function formatShortDate(dateISO: string | null | undefined) {
  if (!dateISO) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateISO}T00:00:00`));
}

function formatLongDate(dateISO: string | null | undefined) {
  if (!dateISO) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateISO}T00:00:00`));
}

function todayIso() {
  const now = new Date();
  return toIsoDate(now);
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function statusLabel(status: AssignmentStatus) {
  return statusOptions.find((option) => option.id === status)?.label ?? status;
}

function statusClasses(status: AssignmentStatus) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700";
  if (status === "overdue") return "bg-rose-50 text-rose-700";
  if (status === "in_progress") return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function courseSort(
  a: Course,
  b: Course,
  foldersById: Map<string, CourseFolder>
) {
  const folderDelta = courseChronology(a, foldersById) - courseChronology(b, foldersById);
  if (folderDelta !== 0) return folderDelta;
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}

function assignmentSort(a: Assignment, b: Assignment) {
  return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
}

function MobileBottomSheet({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const sheetSwipeHandlers = useHorizontalSwipeExit(onClose, open);
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] overscroll-none bg-slate-950/35"
      role="presentation"
      style={{ position: "fixed", zIndex: 80 }}
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full"
        aria-label="Close sheet"
        onClick={onClose}
      />
      <section
        className="absolute inset-x-0 bottom-0 max-h-[94dvh] overflow-y-auto overscroll-contain rounded-t-[2rem] border border-white/70 bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onPointerDown={(event) => {
          event.stopPropagation();
          sheetSwipeHandlers.onPointerDown(event);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          sheetSwipeHandlers.onPointerUp(event);
        }}
        onPointerCancel={(event) => {
          event.stopPropagation();
          sheetSwipeHandlers.onPointerCancel();
        }}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black tracking-tight text-slate-950">
            {title}
          </h2>
          <button
            type="button"
            className="grid min-h-11 min-w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 active:scale-[0.98]"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body
  );
}

function MobileField({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="block text-base font-bold text-slate-700">
      {label}
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1 text-sm font-semibold text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-sm font-bold text-rose-600">{error}</p>}
    </label>
  );
}

function MobileDateWheelColumn({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: number; label: string }>;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-center text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="max-h-52 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-slate-50 p-1 snap-y">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              className={`mb-1 min-h-10 w-full rounded-xl text-sm font-black snap-center active:scale-[0.98] ${
                active
                  ? "bg-slate-950 text-white shadow-soft"
                  : "bg-white text-slate-600"
              }`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileDateWheelSheet({
  open,
  value,
  onChange,
  onClose,
}: {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const initial = datePartsFromMobileValue(value);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);
  const [year, setYear] = useState(initial.year);

  useEffect(() => {
    if (!open) return;
    const next = datePartsFromMobileValue(value);
    setMonth(next.month);
    setDay(next.day);
    setYear(next.year);
  }, [open, value]);

  const maxDay = daysInMonth(year, month);
  useEffect(() => {
    if (day > maxDay) setDay(maxDay);
  }, [day, maxDay]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 9 }, (_, index) => currentYear - 1 + index);

  return (
    <MobileBottomSheet title="Pick date" open={open} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-[1.6rem] border border-white/70 bg-slate-950 p-4 text-white shadow-soft">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
            Due date
          </p>
          <p className="mt-1 text-3xl font-black tracking-tight">
            {mobileMonths[month - 1]} {day}, {year}
          </p>
        </div>
        <div className="grid grid-cols-[1fr_0.72fr_0.86fr] gap-2">
          <MobileDateWheelColumn
            label="Month"
            value={month}
            options={mobileMonths.map((label, index) => ({
              value: index + 1,
              label,
            }))}
            onChange={setMonth}
          />
          <MobileDateWheelColumn
            label="Day"
            value={day}
            options={Array.from({ length: maxDay }, (_, index) => ({
              value: index + 1,
              label: String(index + 1),
            }))}
            onChange={setDay}
          />
          <MobileDateWheelColumn
            label="Year"
            value={year}
            options={years.map((option) => ({
              value: option,
              label: String(option),
            }))}
            onChange={setYear}
          />
        </div>
        <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
          <button
            type="button"
            className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 text-base font-black text-slate-600 active:scale-[0.98]"
            onClick={() => {
              onChange("");
              onClose();
            }}
          >
            Clear
          </button>
          <button
            type="button"
            className="mobile-glow-action min-h-11 rounded-2xl px-4 text-base font-black active:scale-[0.98]"
            onClick={() => {
              onChange(toMobileIsoDate(year, month, Math.min(day, maxDay)));
              onClose();
            }}
          >
            Set date
          </button>
        </div>
      </div>
    </MobileBottomSheet>
  );
}

function MobileMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-3xl border border-white/70 bg-white/95 p-4 shadow-soft backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-3xl font-black tabular-nums tracking-tight text-slate-950">
        {value}
      </div>
      <p className="mt-1 text-sm font-semibold leading-snug text-slate-500">
        {detail}
      </p>
    </article>
  );
}

function MobileSchoolMark({
  themeId,
  label,
  className = "",
}: {
  themeId: string;
  label: string;
  className?: string;
}) {
  const logoSrc = schoolLogoSrc(themeId);

  if (!logoSrc) {
    return <MarkMateLogo size="sm" className={className} />;
  }

  return (
    <span
      className={`relative grid h-14 w-24 shrink-0 place-items-center overflow-hidden rounded-[1.15rem] border border-white/55 bg-white/25 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_18px_34px_-28px_rgba(15,23,42,0.65)] backdrop-blur ${className}`}
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 8%, rgba(255,255,255,0.88), transparent 28%), radial-gradient(circle at 92% 92%, color-mix(in srgb, var(--theme-accent) 22%, transparent), transparent 42%), linear-gradient(135deg, color-mix(in srgb, var(--theme-primary) 24%, white), color-mix(in srgb, var(--theme-accent) 18%, white))",
      }}
      role="img"
      aria-label={`${label} logo`}
    >
      <span className="absolute inset-0 rounded-[1.15rem] border border-white/35" />
      <span className="absolute inset-x-2 top-1.5 h-5 rounded-full bg-white/32 blur-md" />
      <img
        src={logoSrc}
        alt=""
        className="relative z-[1] block object-contain drop-shadow-[0_10px_18px_rgba(15,23,42,0.18)]"
        style={{
          width: "5.25rem",
          height: "2.75rem",
          objectFit: "contain",
          transform: `scale(${schoolLogoScale(themeId)})`,
        }}
        draggable={false}
      />
    </span>
  );
}

function courseWeightStatus(totalWeights: number) {
  if (Math.abs(totalWeights - 100) <= 0.01) {
    return {
      label: "Weights add to 100%",
      detail: "Ready for GPA and pass planning",
      tone: "good" as const,
    };
  }
  if (totalWeights > 100) {
    return {
      label: `Over by ${formatPercent(totalWeights - 100)}`,
      detail: "Lower one weight before final GPA",
      tone: "bad" as const,
    };
  }
  return {
    label:
      totalWeights <= 0
        ? "Add assignment weights"
        : `Missing ${formatPercent(100 - totalWeights)}`,
    detail: "Course tools unlock fully at 100%",
    tone: "warn" as const,
  };
}

function MobileProgressRing({
  value,
  label,
  detail,
  color = "var(--theme-primary)",
  tone = "neutral",
}: {
  value: number | null;
  label: string;
  detail: string;
  color?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const size = 38;
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const progress = clampPercent(value ?? 0);
  const ringColor =
    tone === "good"
      ? "#16a34a"
      : tone === "warn"
      ? "#d97706"
      : tone === "bad"
      ? "#e11d48"
      : color;

  return (
    <div
      className="rounded-[1rem] border border-slate-200 bg-white px-1.5 py-1.5 text-center"
      title={detail}
    >
      <div className="mx-auto grid justify-items-center gap-1">
        <div className="relative grid h-10 w-10 shrink-0 place-items-center">
          <svg
            className="-rotate-90"
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="4.5"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeLinecap="round"
              strokeWidth="4.5"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (progress / 100) * circumference}
            />
          </svg>
          <span className="absolute text-[0.66rem] font-black tabular-nums text-slate-950">
            {value == null ? "--" : `${Math.round(value)}%`}
          </span>
        </div>
        <p className="text-[0.58rem] font-black uppercase tracking-wide text-slate-500">
          {label}
        </p>
      </div>
    </div>
  );
}

function MobileCourseProgressPanel({
  course,
  metrics,
  onOpenPass,
}: {
  course: Course;
  metrics: ReturnType<typeof calcMetrics>;
  onOpenPass: () => void;
}) {
  const weightStatus = courseWeightStatus(metrics.totalWeights);
  const completeAssignments = course.assignments.filter(
    (assignment) => assignment.status === "completed"
  ).length;

  return (
    <section className="rounded-[1.45rem] border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
            Course progress
          </p>
          <h2 className="text-base font-black tracking-tight">Snapshot</h2>
        </div>
        <span
          className={`max-w-[8.2rem] rounded-full px-2 py-1 text-right text-[0.62rem] font-black leading-tight ${
            weightStatus.tone === "good"
              ? "bg-emerald-50 text-emerald-700"
              : weightStatus.tone === "bad"
              ? "bg-rose-50 text-rose-700"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {weightStatus.label}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <MobileProgressRing
          label="Grade"
          value={metrics.gradeSoFar}
          detail="Grade so far"
          color={course.color ?? "var(--theme-primary)"}
        />
        <MobileProgressRing
          label="Done"
          value={metrics.displayCompleted}
          detail={`${completeAssignments}/${course.assignments.length} assignments done`}
          color={course.color ?? "var(--theme-primary)"}
        />
        <MobileProgressRing
          label="Weights"
          value={metrics.totalWeights}
          detail={weightStatus.detail}
          tone={weightStatus.tone}
        />
      </div>
      <button
        type="button"
        className="mobile-glow-action mt-2 flex min-h-10 w-full items-center justify-between gap-3 rounded-2xl px-3 text-left text-sm font-black active:scale-[0.99]"
        onClick={onOpenPass}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <Target className="h-4 w-4 shrink-0" />
          <span className="truncate">Need to pass?</span>
        </span>
        <span className="shrink-0 text-xs font-black text-white/58">
          {completeAssignments}/{course.assignments.length} done
        </span>
      </button>
    </section>
  );
}

function MobileGpaHero({
  report,
  onOpenGpa,
}: {
  report: UniversityGpaReport;
  onOpenGpa: () => void;
}) {
  const appMode = useCourseStore((state) => state.appMode ?? "custom");
  const completeCourses = report.cumulative.includedCourses.length;
  const waitingCount = gpaWaitingCourseCount(report);
  const primaryLabel =
    appMode === "university" ? report.policy.shortName : "MarkMate";

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 p-5 text-white shadow-[0_24px_64px_-34px_rgba(15,23,42,0.75)]">
      <div
        className="absolute inset-0 opacity-95"
        style={{
          background:
            "linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-primary) 48%, var(--theme-accent) 100%)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.26),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.12),transparent)]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">
              GPA estimate
            </p>
            <div className="mt-3 text-[3.45rem] font-black leading-none tracking-tight">
              {formatSchoolAverage(report)}
            </div>
            <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-white/75">
              {primaryLabel}
            </p>
          </div>
          <button
            type="button"
            className="grid min-h-11 min-w-11 place-items-center rounded-full border border-white/30 bg-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur active:scale-[0.98]"
            onClick={onOpenGpa}
            aria-label="Open GPA details"
          >
            <CircleHelp className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-wide text-white/60">
              Included
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums">
              {completeCourses}
            </p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-wide text-white/60">
              Waiting
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums">
              {waitingCount}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyCourses({ onAddCourse }: { onAddCourse: () => void }) {
  return (
    <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white/95 p-6 text-center shadow-soft backdrop-blur">
      <MarkMateLogo size="lg" className="mx-auto" />
      <h2 className="mt-4 text-2xl font-black tracking-tight">
        Add your first course.
      </h2>
      <p className="mx-auto mt-2 max-w-xs text-base leading-relaxed text-slate-500">
        Start with one class, then add assignments from the course page.
      </p>
      <button
        type="button"
        className="mobile-glow-action mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold active:scale-[0.98]"
        onClick={onAddCourse}
      >
        <Plus className="h-5 w-5" />
        Add course
      </button>
    </section>
  );
}

function EmptyCustomStructure({
  onAddYear,
  onQuickCourse,
}: {
  onAddYear: () => void;
  onQuickCourse: () => void;
}) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur">
      <div className="flex items-start gap-4">
        <MarkMateLogo size="md" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Custom setup
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">
            Build your year first.
          </h2>
          <p className="mt-2 text-base leading-relaxed text-slate-500">
            Add any year, any semester, then place courses inside it.
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-[1.15fr_0.85fr] gap-2">
        <button
          type="button"
          className="mobile-glow-action inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-base font-black active:scale-[0.98]"
          onClick={onAddYear}
        >
          <Plus className="h-5 w-5" />
          New year
        </button>
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-base font-black text-slate-700 active:scale-[0.98]"
          onClick={onQuickCourse}
        >
          Quick course
        </button>
      </div>
    </section>
  );
}

function MobileIdentityCard({
  courseCount,
  semesterCount,
}: {
  courseCount: number;
  semesterCount: number;
}) {
  const appMode = useCourseStore((state) => state.appMode ?? "custom");
  const setAppMode = useCourseStore((state) => state.setAppMode);
  const universityThemeId = useCourseStore(
    (state) => state.universityThemeId ?? "uoft"
  );
  const customThemeId = useCourseStore((state) => state.customThemeId ?? "classic");
  const activeTheme = getActiveTheme(appMode, universityThemeId, customThemeId);
  const brandPalette = getMarkMateBrandPalette(
    appMode,
    universityThemeId,
    customThemeId
  );
  const imageLayer = activeTheme.backgroundImage
    ? `linear-gradient(90deg, rgba(15,23,42,0.92), rgba(15,23,42,0.62)), url(${activeTheme.backgroundImage})`
    : `linear-gradient(135deg, color-mix(in srgb, ${brandPalette.logoPrimary} 34%, #020617), #0f172a 58%, color-mix(in srgb, ${brandPalette.logoAccent} 28%, #1e293b))`;
  const campusBubbleLayer = activeTheme.backgroundImage
    ? `linear-gradient(180deg, rgba(15,23,42,0.08), rgba(15,23,42,0.24)), url(${activeTheme.backgroundImage})`
    : `radial-gradient(circle at 25% 20%, ${brandPalette.logoAccent}, transparent 48%), linear-gradient(135deg, ${brandPalette.logoPrimary}, #0f172a)`;

  return (
    <section
      className="relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-slate-950 p-3 text-white shadow-[0_20px_56px_-36px_rgba(15,23,42,0.72)]"
      style={{
        backgroundImage: imageLayer,
        backgroundPosition: activeTheme.position ?? "center",
        backgroundSize: "cover",
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_52%,rgba(2,6,23,0.28))]" />
      <div className="relative">
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <MobileSchoolMark
                themeId={activeTheme.id}
                label={activeTheme.label}
                className="ring-white/35"
              />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">
                  MarkMate
                </p>
                <h1 className="truncate text-2xl font-black tracking-tight">
                  {activeTheme.label}
                </h1>
              </div>
            </div>
            <p className="mt-3 text-sm font-bold leading-snug text-white/70">
              {courseCount} courses / {semesterCount} semesters
            </p>
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl border border-white/20 bg-white/10 p-1 backdrop-blur">
              {[
                { id: "custom", label: "Custom" },
                { id: "university", label: "School" },
              ].map((option) => {
                const active = appMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`min-h-9 rounded-xl text-xs font-black active:scale-[0.98] ${
                      active ? "bg-white text-slate-950" : "text-white/70"
                    }`}
                    onClick={() => setAppMode(option.id as "custom" | "university")}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div
            className="min-h-32 rounded-[1.45rem] border border-white/20 bg-cover bg-center shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
            style={{
              backgroundImage: campusBubbleLayer,
              backgroundPosition: activeTheme.backgroundImage
                ? campusBubblePosition(activeTheme.id)
                : "center",
              backgroundSize: "cover",
            }}
            aria-hidden="true"
          >
            <div className="h-full rounded-[1.45rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(2,6,23,0.22))]" />
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileHomeCommandPanel({
  report,
  nextAssignment,
  onAddCourse,
  onGoCourses,
  onGoCalendar,
  onOpenGpa,
  onOpenCourse,
  folderCount,
}: {
  report: UniversityGpaReport;
  nextAssignment?: { course: Course; assignment: Assignment };
  onAddCourse: () => void;
  onGoCourses: () => void;
  onGoCalendar: () => void;
  onOpenGpa: () => void;
  onOpenCourse: (courseId: string) => void;
  folderCount: number;
}) {
  const appMode = useCourseStore((state) => state.appMode ?? "custom");
  const primaryLabel =
    appMode === "university" ? report.policy.shortName : "MarkMate";
  const needsCustomSetup = appMode === "custom" && folderCount === 0;

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/95 p-4 shadow-soft backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Today
          </p>
          <div className="mt-1 text-4xl font-black tracking-tight text-slate-950">
            {formatSchoolAverage(report)}
          </div>
          <p className="mt-1 text-sm font-black uppercase tracking-[0.16em] text-slate-400">
            {primaryLabel}
          </p>
        </div>
        <button
          type="button"
          className="grid min-h-11 min-w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 active:scale-[0.98]"
          onClick={onOpenGpa}
          aria-label="Open GPA details"
        >
          <CircleHelp className="h-5 w-5" />
        </button>
      </div>

      <button
        type="button"
        className="mt-4 flex min-h-[76px] w-full items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-left text-white active:scale-[0.99]"
        onClick={() =>
          nextAssignment
            ? onOpenCourse(nextAssignment.course.id)
            : needsCustomSetup
            ? onGoCourses()
            : onAddCourse()
        }
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/12">
          <CalendarDays className="h-5 w-5 text-white/70" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-black uppercase tracking-wide text-white/50">
            {nextAssignment ? "Next up" : "Start here"}
          </span>
          <span className="mt-0.5 block truncate text-xl font-black">
            {nextAssignment?.assignment.title ||
              (needsCustomSetup ? "Create a year" : "Add a course")}
          </span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-white/58">
            {nextAssignment
              ? `${nextAssignment.course.name} / ${formatShortDate(
                  nextAssignment.assignment.dueDate
                )}`
              : needsCustomSetup
              ? "Set up any year and semester first."
              : "Name it once, then add assignments inside it."}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/50" />
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="mobile-glow-action inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-base font-black active:scale-[0.98]"
          onClick={needsCustomSetup ? onGoCourses : onAddCourse}
        >
          <Plus className="h-5 w-5" />
          {needsCustomSetup ? "New year" : "New course"}
        </button>
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-base font-black text-slate-700 active:scale-[0.98]"
          onClick={onGoCalendar}
        >
          <CalendarDays className="h-5 w-5" />
          Calendar
        </button>
      </div>
    </section>
  );
}

function MobileDashboard({
  onOpenGpa,
  onGoCourses,
  onGoCalendar,
  onAddCourse,
  onOpenCourse,
}: {
  onOpenGpa: () => void;
  onGoCourses: () => void;
  onGoCalendar: () => void;
  onAddCourse: () => void;
  onOpenCourse: (courseId: string) => void;
}) {
  const courses = useCourseStore((state) => state.courses);
  const folders = useCourseStore((state) => state.folders);
  const report = useGpaReport();
  const foldersById = useMemo(
    () =>
      new Map<string, CourseFolder>(
        folders.map((folder) => [folder.id, folder])
      ),
    [folders]
  );
  const nextAssignment = useMemo(() => {
    return courses
      .flatMap((course) =>
        course.assignments
          .filter((assignment) => assignment.status !== "completed")
          .map((assignment) => ({ course, assignment }))
      )
      .sort((a, b) => assignmentSort(a.assignment, b.assignment))[0];
  }, [courses]);
  const activeCourses = useMemo(
    () =>
      courses
        .slice()
        .sort((a, b) => courseSort(a, b, foldersById))
        .slice(0, 3),
    [courses, foldersById]
  );

  return (
    <div className="space-y-4">
      <MobileIdentityCard
        courseCount={courses.length}
        semesterCount={folders.length}
      />
      <MobileHomeCommandPanel
        report={report}
        nextAssignment={nextAssignment}
        onAddCourse={onAddCourse}
        onGoCourses={onGoCourses}
        onGoCalendar={onGoCalendar}
        onOpenGpa={onOpenGpa}
        onOpenCourse={onOpenCourse}
        folderCount={folders.length}
      />

      {courses.length > 0 && (
        <>
          <section className="rounded-[2rem] border border-white/70 bg-white/95 p-4 shadow-soft backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Courses
                </p>
                <h2 className="text-xl font-black tracking-tight">
                  Recent classes
                </h2>
              </div>
              <button
                type="button"
                className="grid min-h-11 min-w-11 place-items-center rounded-full bg-slate-950 text-white active:scale-[0.98]"
                onClick={onGoCourses}
                aria-label="Open courses"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {activeCourses.map((course) => {
                const metrics = calcMetrics(course);
                return (
                  <button
                    key={course.id}
                    type="button"
                    className="flex min-h-[68px] w-full items-center justify-between gap-4 py-3 text-left active:scale-[0.99]"
                    onClick={() => onOpenCourse(course.id)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-slate-950">
                        {course.name}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-500">
                        {folderLabel(course, folders)}
                      </p>
                    </div>
                    <p className="text-lg font-black tabular-nums text-slate-950">
                      {formatPercent(metrics.gradeSoFar)}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MobileCourseCard({
  course,
  folders,
  onOpen,
  compact = false,
}: {
  course: Course;
  folders: CourseFolder[];
  onOpen: () => void;
  compact?: boolean;
}) {
  const metrics = calcMetrics(course);
  const completeAssignments = course.assignments.filter(
    (assignment) => assignment.status === "completed"
  ).length;

  return (
    <button
      type="button"
      className={`w-full border border-white/70 bg-white/95 text-left shadow-soft backdrop-blur active:scale-[0.99] ${
        compact ? "rounded-[1.15rem] px-3 py-2" : "rounded-[1.5rem] p-4"
      }`}
      onClick={onOpen}
    >
      <div
        className={`flex items-center gap-3 ${compact ? "min-h-[42px]" : "min-h-[70px]"}`}
      >
        <div
          className={`${compact ? "h-10 w-1.5" : "h-14 w-2"} rounded-full`}
          style={{ backgroundColor: course.color ?? "var(--theme-primary)" }}
        />
        <div className="min-w-0 flex-1">
          <p
            className={`truncate font-black tracking-tight text-slate-950 ${
              compact ? "text-base" : "text-lg"
            }`}
          >
            {course.name}
          </p>
          <p
            className={`truncate font-semibold text-slate-500 ${
              compact ? "mt-0.5 text-xs" : "mt-1 text-base"
            }`}
          >
            {folderLabel(course, folders)}
          </p>
        </div>
        <div className="text-right">
          <p
            className={`font-black tabular-nums text-slate-950 ${
              compact ? "text-base" : "text-xl"
            }`}
          >
            {formatPercent(metrics.gradeSoFar)}
          </p>
          <p className={`${compact ? "text-xs" : "text-sm"} font-bold text-slate-400`}>
            {Math.round(metrics.displayCompleted)}%
          </p>
        </div>
      </div>
      <div
        className={`${compact ? "mt-1.5 h-1.5" : "mt-3 h-2"} overflow-hidden rounded-full bg-slate-100`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${metrics.displayCompleted}%`,
            backgroundColor: course.color ?? "var(--theme-primary)",
          }}
        />
      </div>
      {!compact && (
        <p className="mt-3 text-base font-semibold text-slate-500">
          {completeAssignments}/{course.assignments.length} assignments complete
        </p>
      )}
    </button>
  );
}

function MobileCourses({
  onOpenCourse,
  onAddCourse,
}: {
  onOpenCourse: (courseId: string) => void;
  onAddCourse: (folderId?: string | null) => void;
}) {
  const courses = useCourseStore((state) => state.courses);
  const folders = useCourseStore((state) => state.folders);
  const appMode = useCourseStore((state) => state.appMode ?? "custom");
  const [query, setQuery] = useState("");
  const [activeScope, setActiveScope] = useState<string | null>(null);
  const [semesterSheet, setSemesterSheet] = useState<CourseFolder | null | "new">(
    null
  );
  const isCustomMode = appMode === "custom";
  const foldersById = useMemo(
    () =>
      new Map<string, CourseFolder>(
        folders.map((folder) => [folder.id, folder])
      ),
    [folders]
  );
  const sortedFolders = useMemo(() => folders.slice().sort(folderSort), [folders]);
  const folderOptions = useMemo(
    () => [
      { id: "all", label: "All classes", folder: null as CourseFolder | null },
      { id: "unfiled", label: "Unfiled", folder: null as CourseFolder | null },
      ...sortedFolders.map((folder) => ({
        id: folder.id,
        label: compactFolderLabel(folder),
        folder,
      })),
    ],
    [sortedFolders]
  );

  const coursesForScope = (scopeId: string) =>
    courses
      .filter((course) =>
        scopeId === "all"
          ? true
          : scopeId === "unfiled"
          ? !course.folderId
          : course.folderId === scopeId
      )
      .sort((a, b) => courseSort(a, b, foldersById));

  const activeScopeOption = activeScope
    ? folderOptions.find((option) => option.id === activeScope)
    : null;
  const closeSemester = () => setActiveScope(null);
  const semesterSwipeHandlers = useHorizontalSwipeExit(closeSemester, Boolean(activeScopeOption));

  const searchResults = courses
    .filter((course) => {
      const folder = course.folderId ? foldersById.get(course.folderId) ?? null : null;
      return smartSearchMatch(
        [
          course.name,
          folderDisplayName(folder),
          folder?.name,
          folder?.year,
          ...course.assignments.map((assignment) => assignment.title),
        ],
        query
      );
    })
    .sort((a, b) => courseSort(a, b, foldersById));

  if (activeScopeOption) {
    const scopedCourses = coursesForScope(activeScopeOption.id);
    const folderId =
      activeScopeOption.id === "all" || activeScopeOption.id === "unfiled"
        ? null
        : activeScopeOption.id;

    return (
      <div className="space-y-3" {...semesterSwipeHandlers}>
        <section className="rounded-[1.65rem] border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="grid min-h-10 min-w-10 place-items-center rounded-2xl bg-slate-950 text-white active:scale-[0.98]"
              onClick={closeSemester}
              aria-label="Back to semesters"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Semester
              </p>
              <h1 className="mt-0.5 truncate text-xl font-black tracking-tight">
                {activeScopeOption.label}
              </h1>
            </div>
            {scopedCourses.length > 0 && (
              <button
                type="button"
                className="mobile-glow-action grid min-h-10 min-w-10 place-items-center rounded-2xl active:scale-[0.98]"
                onClick={() => onAddCourse(folderId)}
                aria-label="Add course"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-500">
            {scopedCourses.length} courses
          </p>
        </section>

        {scopedCourses.length === 0 ? (
          <section className="rounded-[1.65rem] border border-dashed border-slate-300 bg-white/92 p-4 text-center shadow-soft backdrop-blur">
            <ClipboardList className="mx-auto h-7 w-7 text-slate-400" />
            <p className="mt-3 text-base font-black text-slate-600">
              Empty semester
            </p>
            <button
              type="button"
              className="mobile-glow-action mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-black active:scale-[0.98]"
              onClick={() => onAddCourse(folderId)}
            >
              <Plus className="h-5 w-5" />
              Add course
            </button>
          </section>
        ) : (
          <div
            className={`space-y-2 ${
              scopedCourses.length > 8
                ? "max-h-[28rem] overflow-y-auto overscroll-contain pr-1"
                : ""
            }`}
          >
            {scopedCourses.map((course) => (
              <MobileCourseCard
                key={course.id}
                course={course}
                folders={folders}
                onOpen={() => onOpenCourse(course.id)}
                compact
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="rounded-[1.65rem] border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Courses
            </p>
            <h1 className="mt-0.5 text-xl font-black tracking-tight">
              Your classes
            </h1>
          </div>
        </div>
        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search CIV312, COG260, APS100"
            onKeyDown={blurMobileInputOnEnter}
            onBlur={settleMobileInputAfterBlur}
          />
        </label>
        {!query.trim() && courses.length > 0 && (
          <button
            type="button"
            className="mobile-glow-action mt-2 flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-left active:scale-[0.99]"
            onClick={() => onAddCourse()}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/12">
              <Plus className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black">New course</span>
              <span className="mt-0.5 block text-xs font-semibold text-white/58">
                Choose semester next.
              </span>
            </span>
          </button>
        )}
      </section>

      {courses.length === 0 && folders.length === 0 ? (
        isCustomMode ? (
          <EmptyCustomStructure
            onAddYear={() => setSemesterSheet("new")}
            onQuickCourse={() => onAddCourse(null)}
          />
        ) : (
          <EmptyCourses onAddCourse={() => onAddCourse()} />
        )
      ) : query.trim() ? (
        <section className="rounded-[1.65rem] border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Results
          </p>
          <div className="mt-3 space-y-2">
            {searchResults.map((course) => (
              <MobileCourseCard
                key={course.id}
                course={course}
                folders={folders}
                onOpen={() => onOpenCourse(course.id)}
              />
            ))}
            {searchResults.length === 0 && (
              <p className="rounded-3xl border border-dashed border-slate-300 bg-white/90 px-5 py-8 text-center text-base text-slate-500">
                No courses match that search.
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-[1.65rem] border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Semesters
              </p>
              <h2 className="mt-0.5 text-lg font-black tracking-tight">
                Pick one
              </h2>
            </div>
            <p className="text-sm font-black text-slate-400">
              {courses.length} total
            </p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
          {folderOptions.map((option) => {
            const scopedCourses = coursesForScope(option.id);
            const color = option.folder?.color ?? "var(--theme-primary)";
            if (option.id === "unfiled" && scopedCourses.length === 0) {
              return null;
            }
            return (
              <button
                key={option.id}
                type="button"
                className="min-h-[50px] rounded-[1.05rem] border border-slate-200 bg-white px-2.5 py-2 text-left shadow-[0_14px_30px_-30px_rgba(15,23,42,0.45)] active:scale-[0.99]"
                onClick={() => setActiveScope(option.id)}
              >
                <span
                  className="mb-1.5 block h-1.5 w-8 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="block truncate text-[0.82rem] font-black leading-tight text-slate-950">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[0.68rem] font-black text-slate-400">
                  {scopedCourses.length}
                </span>
              </button>
            );
          })}
          </div>
        </section>
      )}
      <MobileSemesterSheet
        open={semesterSheet != null}
        onClose={() => setSemesterSheet(null)}
        folder={semesterSheet === "new" ? null : semesterSheet}
      />
    </div>
  );
}

function MobileCourseCreateSheet({
  open,
  onClose,
  onCreated,
  initialFolderId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (courseId: string) => void;
  initialFolderId?: string | null;
}) {
  const folders = useCourseStore((state) => state.folders);
  const addCourse = useCourseStore((state) => state.addCourse);
  const [name, setName] = useState("");
  const [folderId, setFolderId] = useState<string | null>(
    initialFolderId ?? folders[0]?.id ?? null
  );

  useEffect(() => {
    if (!open) return;
    setName("");
    setFolderId(initialFolderId ?? folders[0]?.id ?? null);
  }, [folders, initialFolderId, open]);

  const submit = () => {
    const courseId = addCourse(name.trim() || "New Course", folderId);
    onClose();
    onCreated(courseId);
  };

  return (
    <MobileBottomSheet title="New course" open={open} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-3xl bg-slate-950 p-4 text-white">
          <p className="text-base font-bold leading-relaxed text-white/72">
            Create the course first. MarkMate opens it right away so assignments
            are the next obvious step.
          </p>
        </div>
        <MobileField label="Course name" hint="Examples: CIV312, COG260, APS100, CIV100">
          <input
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="CIV312"
            onKeyDown={blurMobileInputOnEnter}
            onBlur={settleMobileInputAfterBlur}
          />
        </MobileField>
        <MobileField label="Semester">
          <select
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            value={folderId ?? ""}
            onChange={(event) => setFolderId(event.target.value || null)}
          >
            <option value="">Unfiled</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folderDisplayName(folder)}
              </option>
            ))}
          </select>
        </MobileField>
        <button
          type="button"
          className="mobile-glow-action inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold active:scale-[0.98]"
          onClick={submit}
        >
          <Plus className="h-5 w-5" />
          Create course
        </button>
      </div>
    </MobileBottomSheet>
  );
}

type MobileAssignmentComposerMode = "single" | "bulk";

type MobileBulkAssignmentDraft = {
  rowId: string;
  title: string;
  dueDate: string;
  weight: string;
  status: AssignmentStatus;
  grade: string;
};

const blankMobileBulkRow = (): MobileBulkAssignmentDraft => ({
  rowId: mobileId(),
  title: "",
  dueDate: "",
  weight: "",
  status: "not_started",
  grade: "",
});

const mobileBulkRows = (count: number) =>
  Array.from({ length: count }, () => blankMobileBulkRow());

function MobileAssignmentComposer({
  course,
  mode,
  onModeChange,
  onClose,
}: {
  course: Course;
  mode: MobileAssignmentComposerMode;
  onModeChange: (mode: MobileAssignmentComposerMode) => void;
  onClose: () => void;
}) {
  const addAssignment = useCourseStore((state) => state.addAssignment);
  const addAssignments = useCourseStore((state) => state.addAssignments);
  const [title, setTitle] = useState("");
  const [weight, setWeight] = useState("");
  const [grade, setGrade] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<AssignmentStatus>("not_started");
  const [bulkRows, setBulkRows] = useState<MobileBulkAssignmentDraft[]>(
    mobileBulkRows(6)
  );
  const [singleDateOpen, setSingleDateOpen] = useState(false);
  const [bulkDateRowId, setBulkDateRowId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setTitle("");
    setWeight("");
    setGrade("");
    setDueDate("");
    setStatus("not_started");
    setBulkRows(mobileBulkRows(6));
    setSingleDateOpen(false);
    setBulkDateRowId(null);
    setError("");
  }, [course.id]);

  const saveSingle = () => {
    const parsedWeight = weight.trim() === "" ? 0 : parseFlexibleNumber(weight);
    const parsedGrade = grade.trim() === "" ? null : parseGradeInput(grade);
    if (parsedWeight == null || parsedWeight < 0 || parsedWeight > 1000) {
      setError("Check the weight.");
      return;
    }
    if (grade.trim() && (parsedGrade == null || parsedGrade < 0 || parsedGrade > 100)) {
      setError("Check the grade.");
      return;
    }
    addAssignment(course.id, {
      title: title.trim() || "Untitled assignment",
      dueDate: dueDate || null,
      weight: parsedWeight,
      grade: parsedGrade,
      status: parsedGrade == null ? status : "completed",
    });
    onClose();
  };

  const updateBulkRow = (
    rowId: string,
    patch: Partial<MobileBulkAssignmentDraft>
  ) => {
    setBulkRows((rows) =>
      rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
    );
    setError("");
  };

  const duplicateBulkRow = (rowId: string) => {
    setBulkRows((rows) => {
      const index = rows.findIndex((row) => row.rowId === rowId);
      if (index === -1) return rows;
      const copy = { ...rows[index], rowId: mobileId() };
      return [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)];
    });
    setError("");
  };

  const removeBulkRow = (rowId: string) => {
    setBulkRows((rows) =>
      rows.length <= 1
        ? [blankMobileBulkRow()]
        : rows.filter((row) => row.rowId !== rowId)
    );
    setError("");
  };

  const saveBulk = () => {
    const activeRows = bulkRows.filter((row) =>
      [row.title, row.dueDate, row.weight, row.grade].some((value) =>
        value.trim()
      )
    );
    if (!activeRows.length) {
      setError("Add at least one row.");
      return;
    }

    const prepared: Array<Omit<Assignment, "id">> = [];
    for (const row of activeRows) {
      if (!row.title.trim()) {
        setError("Every row needs a name.");
        return;
      }
      const normalizedDate = normalizeMobileDateInput(row.dueDate);
      if (normalizedDate == null) {
        setError(`Check the date for ${row.title}.`);
        return;
      }
      const parsedWeight =
        row.weight.trim() === "" ? 0 : parseFlexibleNumber(row.weight);
      if (parsedWeight == null || parsedWeight < 0 || parsedWeight > 1000) {
        setError(`Check the weight for ${row.title}.`);
        return;
      }
      let parsedGrade: number | null = null;
      if (row.grade.trim()) {
        parsedGrade = parseGradeInput(row.grade);
        if (parsedGrade == null || parsedGrade < 0 || parsedGrade > 100) {
          setError(`Check the grade for ${row.title}.`);
          return;
        }
      }
      prepared.push({
        title: row.title.trim(),
        dueDate: normalizedDate || null,
        weight: parsedWeight,
        grade: parsedGrade,
        status: parsedGrade == null ? row.status : "completed",
      });
    }

    addAssignments(course.id, prepared);
    onClose();
  };

  const activeBulkDateRow =
    bulkRows.find((row) => row.rowId === bulkDateRowId) ?? null;

  return (
    <div className="mt-4 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1">
        {[
          { id: "single", label: "One", icon: Plus },
          { id: "bulk", label: "Bulk", icon: ListPlus },
        ].map((option) => {
          const Icon = option.icon;
          const active = mode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl text-sm font-black active:scale-[0.98] ${
                active ? "bg-slate-950 text-white" : "text-slate-500"
              }`}
              onClick={() => {
                onModeChange(option.id as MobileAssignmentComposerMode);
                setError("");
              }}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
      </div>

      {mode === "single" ? (
        <div className="mt-3 space-y-3">
          <MobileField label="Name">
              <input
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError("");
                }}
                placeholder="Midterm"
                onKeyDown={blurMobileInputOnEnter}
                onBlur={settleMobileInputAfterBlur}
              />
            </MobileField>
          <div className="grid grid-cols-2 gap-3">
            <MobileField label="Weight">
              <input
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                inputMode="decimal"
                value={weight}
                onChange={(event) => {
                  setWeight(event.target.value);
                  setError("");
                }}
                placeholder="25"
                onKeyDown={blurMobileInputOnEnter}
                onBlur={settleMobileInputAfterBlur}
              />
            </MobileField>
            <MobileField label="Grade">
              <input
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                inputMode="decimal"
                value={grade}
                onChange={(event) => {
                  setGrade(event.target.value);
                  setError("");
                }}
                placeholder="88"
                onKeyDown={blurMobileInputOnEnter}
                onBlur={settleMobileInputAfterBlur}
              />
            </MobileField>
          </div>
          <MobileField label="Due">
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-left text-base font-semibold text-slate-950 active:scale-[0.99]"
              onClick={() => setSingleDateOpen(true)}
            >
              <span>{dueDate ? formatMobileDateChip(dueDate) : "Pick date"}</span>
              <CalendarDays className="h-5 w-5 text-slate-400" />
            </button>
          </MobileField>
          <MobileField label="Status">
            <select
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
              value={status}
              onChange={(event) => setStatus(event.target.value as AssignmentStatus)}
            >
              {statusOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </MobileField>
          <button
            type="button"
            className="mobile-glow-action inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-black active:scale-[0.98]"
            onClick={saveSingle}
          >
            <Check className="h-5 w-5" />
            Add assignment
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-2">
            <div className="grid grid-cols-[1rem_minmax(3.4rem,1fr)_2.15rem_2.15rem_3rem_1.55rem_1.55rem] gap-0.5 px-1 pb-1 text-[0.6rem] font-black uppercase tracking-wide text-slate-400">
              <span>#</span>
              <span>Name</span>
              <span>Wt</span>
              <span>Gr</span>
              <span>Date</span>
              <span>Dup</span>
              <span>Del</span>
            </div>
            <div
              className={`space-y-1 pr-1 ${
                bulkRows.length > 11
                  ? "max-h-[26rem] overflow-y-auto overscroll-contain"
                  : ""
              }`}
            >
              {bulkRows.map((row, index) => (
                <div
                  key={row.rowId}
                  className="grid grid-cols-[1rem_minmax(3.4rem,1fr)_2.15rem_2.15rem_3rem_1.55rem_1.55rem] items-center gap-0.5"
                >
                  <span className="text-center text-[0.7rem] font-black tabular-nums text-slate-400">
                    {index + 1}
                  </span>
                  <input
                    className="h-8 min-w-0 rounded-lg bg-slate-50 px-1.5 text-base font-black leading-none text-slate-950 outline-none focus:ring-2 focus:ring-slate-950/10"
                    value={row.title}
                    onChange={(event) =>
                      updateBulkRow(row.rowId, { title: event.target.value })
                    }
                    placeholder="Quiz"
                    onKeyDown={blurMobileInputOnEnter}
                    onBlur={settleMobileInputAfterBlur}
                  />
                  <input
                    className="h-8 min-w-0 rounded-lg border border-slate-200 bg-white px-1 text-base font-bold leading-none text-slate-900 outline-none focus:ring-2 focus:ring-slate-950/10"
                    inputMode="decimal"
                    value={row.weight}
                    onChange={(event) =>
                      updateBulkRow(row.rowId, { weight: event.target.value })
                    }
                    placeholder="10"
                    onKeyDown={blurMobileInputOnEnter}
                    onBlur={settleMobileInputAfterBlur}
                  />
                  <input
                    className="h-8 min-w-0 rounded-lg border border-slate-200 bg-white px-1 text-base font-bold leading-none text-slate-900 outline-none focus:ring-2 focus:ring-slate-950/10"
                    inputMode="decimal"
                    value={row.grade}
                    onChange={(event) =>
                      updateBulkRow(row.rowId, { grade: event.target.value })
                    }
                    placeholder="88"
                    onKeyDown={blurMobileInputOnEnter}
                    onBlur={settleMobileInputAfterBlur}
                  />
                  <button
                    type="button"
                    className="h-8 min-w-0 truncate rounded-lg border border-slate-200 bg-white px-1 text-left text-[0.7rem] font-black text-slate-700 active:scale-[0.98]"
                    onClick={() => setBulkDateRowId(row.rowId)}
                    aria-label={`Pick date for row ${index + 1}`}
                  >
                    {formatMobileDateChip(row.dueDate)}
                  </button>
                  <button
                    type="button"
                    className="grid h-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 active:scale-[0.96]"
                    onClick={() => duplicateBulkRow(row.rowId)}
                    aria-label={`Duplicate row ${index + 1}`}
                  >
                    <CopyPlus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="grid h-8 place-items-center rounded-lg border border-rose-100 bg-rose-50 text-rose-600 active:scale-[0.96]"
                    onClick={() => removeBulkRow(row.rowId)}
                    aria-label={`Delete row ${index + 1}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
            <button
              type="button"
              className="min-h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 active:scale-[0.98]"
              onClick={() => setBulkRows((rows) => [...rows, blankMobileBulkRow()])}
            >
              Add row
            </button>
            <button
              type="button"
              className="mobile-glow-action inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-black active:scale-[0.98]"
              onClick={saveBulk}
            >
              <ListPlus className="h-4 w-4" />
              Add bulk
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-base font-bold text-rose-700">
          {error}
        </p>
      )}
      <MobileDateWheelSheet
        open={singleDateOpen}
        value={dueDate}
        onChange={(nextDate) => {
          setDueDate(nextDate);
          setError("");
        }}
        onClose={() => setSingleDateOpen(false)}
      />
      <MobileDateWheelSheet
        open={activeBulkDateRow != null}
        value={activeBulkDateRow?.dueDate ?? ""}
        onChange={(nextDate) => {
          if (activeBulkDateRow) {
            updateBulkRow(activeBulkDateRow.rowId, { dueDate: nextDate });
          }
        }}
        onClose={() => setBulkDateRowId(null)}
      />
    </div>
  );
}

function MobileAssignmentSheet({
  open,
  onClose,
  course,
  assignment,
}: {
  open: boolean;
  onClose: () => void;
  course: Course;
  assignment: Assignment | null;
}) {
  const addAssignment = useCourseStore((state) => state.addAssignment);
  const updateAssignment = useCourseStore((state) => state.updateAssignment);
  const removeAssignment = useCourseStore((state) => state.removeAssignment);
  const [title, setTitle] = useState("");
  const [weight, setWeight] = useState("");
  const [grade, setGrade] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<AssignmentStatus>("not_started");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(assignment?.title ?? "");
    setWeight(
      assignment ? String(Number(normalizeWeightToPercent(assignment.weight).toFixed(2))) : ""
    );
    setGrade(assignment?.grade == null ? "" : String(assignment.grade));
    setDueDate(assignment?.dueDate ?? "");
    setStatus(assignment?.status ?? "not_started");
    setError("");
  }, [assignment, open]);

  const save = () => {
    const parsedWeight = weight.trim() === "" ? 0 : parseFlexibleNumber(weight);
    const parsedGrade = grade.trim() === "" ? null : parseGradeInput(grade);
    if (parsedWeight == null || !Number.isFinite(parsedWeight)) {
      setError("Enter a valid weight.");
      return;
    }
    if (grade.trim() !== "" && (parsedGrade == null || !Number.isFinite(parsedGrade))) {
      setError("Enter a valid grade.");
      return;
    }
    const payload = {
      title: title.trim() || "Untitled assignment",
      dueDate: dueDate || null,
      weight: parsedWeight,
      grade: parsedGrade,
      status: parsedGrade == null ? status : ("completed" as AssignmentStatus),
    };
    if (assignment) {
      updateAssignment(course.id, assignment.id, payload);
    } else {
      addAssignment(course.id, payload);
    }
    onClose();
  };

  return (
    <MobileBottomSheet
      title={assignment ? "Edit assignment" : "Add assignment"}
      open={open}
      onClose={onClose}
    >
      <div className="space-y-4">
        <MobileField label="Assignment name">
          <div className="relative">
            <Edit3 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Midterm, lab, final"
            />
          </div>
        </MobileField>
        <div className="grid grid-cols-2 gap-3">
          <MobileField label="Weight">
            <input
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
              inputMode="decimal"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              placeholder="25"
            />
          </MobileField>
          <MobileField label="Grade">
            <input
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
              inputMode="decimal"
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              placeholder="88"
            />
          </MobileField>
        </div>
        <MobileField label="Due date">
          <input
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </MobileField>
        <MobileField label="Status">
          <select
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            value={status}
            onChange={(event) => setStatus(event.target.value as AssignmentStatus)}
          >
            {statusOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </MobileField>
        {error && (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-base font-bold text-rose-700">
            {error}
          </p>
        )}
        <button
          type="button"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-base font-bold text-white shadow-soft active:scale-[0.98]"
          onClick={save}
        >
          <Check className="h-5 w-5" />
          Save assignment
        </button>
        {assignment && (
          <button
            type="button"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-base font-bold text-rose-700 active:scale-[0.98]"
            onClick={() => {
              removeAssignment(course.id, assignment.id);
              onClose();
            }}
          >
            <Trash2 className="h-5 w-5" />
            Delete assignment
          </button>
        )}
      </div>
    </MobileBottomSheet>
  );
}

function MobilePassHelperSheet({
  open,
  onClose,
  course,
}: {
  open: boolean;
  onClose: () => void;
  course: Course;
}) {
  const [targetDraft, setTargetDraft] = useState("50");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const metrics = calcMetrics(course);
  const weightsReady = Math.abs(metrics.totalWeights - 100) <= 0.01;
  const target = clampPercent(parseGradeInput(targetDraft) ?? 50);
  const result = useMemo(() => {
    if (!weightsReady) return null;
    return calculatePassPlan(course, selectedIds, target);
  }, [course, selectedIds, target, weightsReady]);

  useEffect(() => {
    if (!open) return;
    const defaultIds = course.assignments
      .filter(
        (assignment) =>
          assignment.grade == null || assignment.status !== "completed"
      )
      .map((assignment) => assignment.id);
    setSelectedIds(new Set(defaultIds));
    setTargetDraft("50");
  }, [course, open]);

  return (
    <MobileBottomSheet title="Need to pass" open={open} onClose={onClose}>
      <div className="space-y-3">
        <section className="rounded-3xl bg-slate-950 p-4 text-white">
          <div className="grid grid-cols-[1fr_6.5rem] gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/50">
                Target
              </p>
              <p className="mt-2 text-base font-bold leading-snug text-white/68">
                Select unfinished work.
              </p>
            </div>
            <label className="block text-xs font-black uppercase tracking-wide text-white/45">
              Final
              <input
                className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-white px-3 text-center text-xl font-black text-slate-950 outline-none focus:ring-2 focus:ring-white/25"
                inputMode="decimal"
                value={targetDraft}
                onChange={(event) => setTargetDraft(event.target.value)}
                placeholder="50"
              />
            </label>
          </div>
          {weightsReady && result && (
            <div
              className={`mt-3 rounded-2xl px-4 py-3 text-base font-black leading-snug ${
                result.alreadySafe || result.possible
                  ? "bg-emerald-400/14 text-emerald-100"
                  : "bg-rose-400/14 text-rose-100"
              }`}
            >
              {result.alreadySafe
                ? `Already safe near ${formatPercent(result.projectedMark)}.`
                : result.possible
                ? `Need about ${formatPercent(result.neededEach)} on selected work.`
                : `${formatPercent(result.neededEach)} needed is not reachable here.`}
            </div>
          )}
          {weightsReady && !result && (
            <p className="mt-3 rounded-2xl bg-white/8 px-4 py-3 text-sm font-bold text-white/65">
              Select at least one assignment.
            </p>
          )}
        </section>

        {!weightsReady && (
          <p className="rounded-2xl bg-amber-50 p-4 text-base font-bold leading-relaxed text-amber-800">
            This calculator needs the course weights to total 100%. Right now
            they total {formatPercent(metrics.totalWeights)}.
          </p>
        )}

        <div className="max-h-[38dvh] space-y-2 overflow-y-auto overscroll-contain pr-1">
          {course.assignments.map((assignment) => {
            const active = selectedIds.has(assignment.id);
            return (
              <button
                key={assignment.id}
                type="button"
                className={`flex min-h-[58px] w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left active:scale-[0.99] ${
                  active
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
                onClick={() =>
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (next.has(assignment.id)) next.delete(assignment.id);
                    else next.add(assignment.id);
                    return next;
                  })
                }
                >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
                    active
                      ? "border-white/50 bg-white/15"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  {active && <Check className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-black">
                    {assignment.title}
                  </span>
                  <span
                    className={`mt-0.5 block text-sm font-semibold ${
                      active ? "text-white/60" : "text-slate-500"
                    }`}
                  >
                    {formatPercent(normalizeWeightToPercent(assignment.weight))} weight
                    / grade {assignment.grade == null ? "--" : formatPercent(assignment.grade)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </MobileBottomSheet>
  );
}

function MobileCourseDetail({
  courseId,
  onBack,
}: {
  courseId: string;
  onBack: () => void;
}) {
  const courses = useCourseStore((state) => state.courses);
  const renameCourse = useCourseStore((state) => state.renameCourse);
  const [assignmentSheet, setAssignmentSheet] = useState<Assignment | null>(null);
  const [assignmentComposerMode, setAssignmentComposerMode] =
    useState<MobileAssignmentComposerMode | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const report = useGpaReport();
  const course = courses.find((item) => item.id === courseId);
  const exitCourse = () => {
    if (assignmentComposerMode) {
      setAssignmentComposerMode(null);
      return;
    }
    onBack();
  };
  const courseSwipeHandlers = useHorizontalSwipeExit(exitCourse);

  if (!course) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-base font-bold text-white"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
          Courses
        </button>
        <p className="rounded-3xl bg-white/95 p-5 text-base text-slate-500">
          Course not found.
        </p>
      </div>
    );
  }

  const metrics = calcMetrics(course);
  const sortedAssignments = course.assignments.slice().sort(assignmentSort);
  const defaultCreditLabel = `Default ${formatCredits(
    report.policy.defaultCreditWeight
  )}`;

  return (
    <div className="min-h-[100dvh] space-y-3" {...courseSwipeHandlers}>
      <header className="sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-10 -mx-1 rounded-[1.65rem] border border-white/70 bg-white/92 p-2.5 shadow-soft backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid min-h-10 min-w-10 place-items-center rounded-2xl bg-slate-950 text-white active:scale-[0.98]"
            onClick={exitCourse}
            aria-label={
              assignmentComposerMode ? "Close assignment form" : "Back to courses"
            }
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Course
            </p>
            <div className="relative mt-1">
              <Edit3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="min-h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-lg font-black tracking-tight text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                value={course.name}
                onChange={(event) => renameCourse(course.id, event.target.value)}
                aria-label="Course name"
                onKeyDown={blurMobileInputOnEnter}
                onBlur={settleMobileInputAfterBlur}
              />
            </div>
          </div>
          <button
            type="button"
            className="grid min-h-10 min-w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 active:scale-[0.98]"
            onClick={() => setSetupOpen(true)}
            aria-label="Course settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {!assignmentComposerMode && (
        <MobileCourseProgressPanel
          course={course}
          metrics={metrics}
          onOpenPass={() => setPassOpen(true)}
        />
      )}

      <section className="rounded-[1.65rem] border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Assignments
            </p>
            <h2 className="text-lg font-black tracking-tight">Grades and tasks</h2>
          </div>
          <button
            type="button"
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-black active:scale-[0.98] ${
              assignmentComposerMode
                ? "border border-slate-200 bg-white text-slate-600"
                : "mobile-glow-action"
            }`}
            onClick={() =>
              assignmentComposerMode
                ? setAssignmentComposerMode(null)
                : setAssignmentComposerMode("single")
            }
            aria-label={
              assignmentComposerMode ? "Close assignment form" : "Add assignment"
            }
          >
            {assignmentComposerMode ? (
              <X className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>{assignmentComposerMode ? "Close" : "Add"}</span>
          </button>
        </div>
        {assignmentComposerMode && (
          <MobileAssignmentComposer
            course={course}
            mode={assignmentComposerMode}
            onModeChange={setAssignmentComposerMode}
            onClose={() => setAssignmentComposerMode(null)}
          />
        )}
        {!assignmentComposerMode && (
        <div
          className={`mt-3 space-y-1.5 ${
            sortedAssignments.length > 8
              ? "max-h-[27rem] overflow-y-auto overscroll-contain pr-1"
              : ""
          }`}
        >
          {sortedAssignments.map((assignment) => (
            <button
              key={assignment.id}
              type="button"
              className="flex min-h-[40px] w-full items-center gap-2 rounded-[0.95rem] border border-slate-200 bg-white px-3 py-1.5 text-left active:scale-[0.99]"
              onClick={() => setAssignmentSheet(assignment)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.82rem] font-black leading-tight text-slate-950">
                  {assignment.title}
                </p>
                <p className="mt-0.5 truncate text-[0.68rem] font-semibold leading-tight text-slate-500">
                  {formatShortDate(assignment.dueDate)} /{" "}
                  {formatPercent(normalizeWeightToPercent(assignment.weight))}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    assignment.status === "completed"
                      ? "bg-emerald-500"
                      : assignment.status === "in_progress"
                      ? "bg-sky-500"
                      : assignment.status === "overdue"
                      ? "bg-rose-500"
                      : "bg-slate-300"
                  }`}
                  title={statusLabel(assignment.status)}
                />
                <p className="text-sm font-black tabular-nums text-slate-950">
                  {assignment.grade == null ? "--" : formatPercent(assignment.grade)}
                </p>
              </div>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                <Edit3 className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
          {course.assignments.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 px-5 py-8 text-center">
              <ClipboardList className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-3 text-base font-semibold text-slate-500">
                No assignments yet.
              </p>
              <button
                type="button"
                className="mobile-glow-action mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold active:scale-[0.98]"
                onClick={() => setAssignmentComposerMode("single")}
              >
                <Plus className="h-5 w-5" />
                Add assignment
              </button>
            </div>
          )}
        </div>
        )}
      </section>

      <MobileAssignmentSheet
        open={assignmentSheet != null}
        onClose={() => setAssignmentSheet(null)}
        course={course}
        assignment={assignmentSheet}
      />
      <MobilePassHelperSheet
        open={passOpen}
        onClose={() => setPassOpen(false)}
        course={course}
      />
      <MobileCourseSetupSheet
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        course={course}
        defaultCreditLabel={defaultCreditLabel}
        onDeleted={onBack}
      />
    </div>
  );
}

type CalendarItem = {
  course: Course;
  assignment: Assignment;
  folder: CourseFolder | null;
};

function MobileQuickAssignmentSheet({
  open,
  onClose,
  initialDate,
  onOpenCourse,
}: {
  open: boolean;
  onClose: () => void;
  initialDate: string;
  onOpenCourse: (courseId: string) => void;
}) {
  const courses = useCourseStore((state) => state.courses);
  const addAssignment = useCourseStore((state) => state.addAssignment);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCourseId(courses[0]?.id ?? "");
    setTitle("");
    setWeight("");
    setError("");
  }, [courses, open]);

  const submit = () => {
    if (!courseId) {
      setError("Create a course first.");
      return;
    }
    const parsedWeight = weight.trim() === "" ? 0 : parseFlexibleNumber(weight);
    if (parsedWeight == null || !Number.isFinite(parsedWeight)) {
      setError("Enter a valid weight.");
      return;
    }
    addAssignment(courseId, {
      title: title.trim() || "New assignment",
      dueDate: initialDate,
      weight: parsedWeight,
      grade: null,
      status: "not_started",
    });
    onClose();
    onOpenCourse(courseId);
  };

  return (
    <MobileBottomSheet title="Add deadline" open={open} onClose={onClose}>
      <div className="space-y-4">
        {courses.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-slate-300 px-5 py-8 text-center text-base font-semibold text-slate-500">
            Add a course first, then deadlines can live in that course.
          </p>
        ) : (
          <>
            <MobileField label="Course">
              <select
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </MobileField>
            <MobileField label="Assignment">
              <input
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Lab, quiz, project"
              />
            </MobileField>
            <MobileField label="Weight" hint={`Due ${formatLongDate(initialDate)}`}>
              <input
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                inputMode="decimal"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                placeholder="10"
              />
            </MobileField>
          </>
        )}
        {error && (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-base font-bold text-rose-700">
            {error}
          </p>
        )}
        <button
          type="button"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-base font-bold text-white shadow-soft active:scale-[0.98] disabled:opacity-50"
          onClick={submit}
          disabled={courses.length === 0}
        >
          <Plus className="h-5 w-5" />
          Save deadline
        </button>
      </div>
    </MobileBottomSheet>
  );
}

function MobileCalendar({
  onOpenCourse,
}: {
  onOpenCourse: (courseId: string) => void;
}) {
  const courses = useCourseStore((state) => state.courses);
  const folders = useCourseStore((state) => state.folders);
  const updateAssignment = useCourseStore((state) => state.updateAssignment);
  const [activeMonth, setActiveMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [filter, setFilter] = useState("all");
  const [quickOpen, setQuickOpen] = useState(false);
  const foldersById = useMemo(
    () =>
      new Map<string, CourseFolder>(
        folders.map((folder) => [folder.id, folder])
      ),
    [folders]
  );
  const calendarScopes = useMemo(
    () => [
      { id: "all", label: "All" },
      { id: "unfiled", label: "Unfiled" },
      ...folders.map((folder) => ({
        id: folder.id,
        label: folderDisplayName(folder),
      })),
    ],
    [folders]
  );
  const allItems = useMemo<CalendarItem[]>(
    () =>
      courses
        .flatMap((course) =>
          course.assignments
            .filter((assignment) => assignment.dueDate)
            .map((assignment) => ({
              course,
              assignment,
              folder: course.folderId
                ? foldersById.get(course.folderId) ?? null
                : null,
            }))
        )
        .sort((a, b) => assignmentSort(a.assignment, b.assignment)),
    [courses, foldersById]
  );
  const items = useMemo(
    () =>
      allItems.filter((item) =>
        filter === "all"
          ? true
          : filter === "unfiled"
          ? !item.course.folderId
          : item.course.folderId === filter
      ),
    [allItems, filter]
  );
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    items.forEach((item) => {
      const date = item.assignment.dueDate;
      if (!date) return;
      map.set(date, [...(map.get(date) ?? []), item]);
    });
    return map;
  }, [items]);
  const monthDays = useMemo(() => {
    const first = new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [activeMonth]);
  const selectedItems = itemsByDate.get(selectedDate) ?? [];
  const upcomingItems = items
    .filter((item) => (item.assignment.dueDate ?? "") >= todayIso())
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-white/70 bg-white/95 p-4 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Calendar
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">
              Deadlines
            </h1>
          </div>
          <button
            type="button"
            className="grid min-h-12 min-w-12 place-items-center rounded-2xl bg-slate-950 text-white shadow-soft active:scale-[0.98]"
            onClick={() => setQuickOpen(true)}
            aria-label="Add deadline"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-100 p-1.5">
          <button
            type="button"
            className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-white text-slate-700 shadow-soft active:scale-[0.98]"
            onClick={() =>
              setActiveMonth(
                new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1)
              )
            }
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="text-base font-black text-slate-950">
            {monthTitle(activeMonth)}
          </p>
          <button
            type="button"
            className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-white text-slate-700 shadow-soft active:scale-[0.98]"
            onClick={() =>
              setActiveMonth(
                new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1)
              )
            }
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        {calendarScopes.length > 2 && (
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {calendarScopes.map((scope) => {
              const active = filter === scope.id;
              return (
                <button
                  key={scope.id}
                  type="button"
                  className={`min-h-10 shrink-0 rounded-2xl px-4 text-sm font-black ${
                    active
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-600"
                  }`}
                  onClick={() => setFilter(scope.id)}
                >
                  {scope.label}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-black uppercase tracking-wide text-slate-400">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <div key={`${day}-${index}`} className="py-1">
              {day}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {monthDays.map((date) => {
            const iso = toIsoDate(date);
            const isSelected = iso === selectedDate;
            const isToday = iso === todayIso();
            const dim = date.getMonth() !== activeMonth.getMonth();
            const count = itemsByDate.get(iso)?.length ?? 0;
            return (
              <button
                key={iso}
                type="button"
                className={`relative grid min-h-11 place-items-center rounded-2xl text-sm font-black transition active:scale-[0.96] ${
                  isSelected
                    ? "bg-slate-950 text-white"
                    : isToday
                    ? "bg-slate-200 text-slate-950"
                    : "bg-white text-slate-700"
                } ${dim ? "opacity-45" : ""}`}
                onClick={() => setSelectedDate(iso)}
              >
                {date.getDate()}
                {count > 0 && (
                  <span
                    className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${
                      isSelected ? "bg-white" : "bg-slate-950"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-[1.6rem] bg-slate-950 p-3 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-white/45">
                Agenda
              </p>
              <h2 className="mt-1 truncate text-lg font-black">
                {formatLongDate(selectedDate)}
              </h2>
            </div>
            <button
              type="button"
              className="grid min-h-10 min-w-10 place-items-center rounded-2xl bg-white text-slate-950 active:scale-[0.98]"
              onClick={() => setQuickOpen(true)}
              aria-label="Add deadline"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {selectedItems.map((item) => (
              <CalendarAssignmentRow
                key={`${item.course.id}-${item.assignment.id}`}
                item={item}
                onOpenCourse={() => onOpenCourse(item.course.id)}
                onComplete={() =>
                  updateAssignment(item.course.id, item.assignment.id, {
                    status: "completed",
                  })
                }
              />
            ))}
            {selectedItems.length === 0 && (
              <button
                type="button"
                className="min-h-16 w-full rounded-2xl border border-white/12 bg-white/8 px-4 text-left text-base font-black text-white/72 active:scale-[0.99]"
                onClick={() => setQuickOpen(true)}
              >
                No deadlines. Tap to add one.
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/95 p-4 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Up next
          </p>
          <p className="text-sm font-black text-slate-400">
            {upcomingItems.length}
          </p>
        </div>
        <div className="mt-3 space-y-2">
          {upcomingItems.map((item) => (
            <CalendarAssignmentRow
              key={`${item.course.id}-${item.assignment.id}`}
              item={item}
              onOpenCourse={() => onOpenCourse(item.course.id)}
              onComplete={() =>
                updateAssignment(item.course.id, item.assignment.id, {
                  status: "completed",
                })
              }
            />
          ))}
          {upcomingItems.length === 0 && (
            <p className="rounded-3xl border border-dashed border-slate-300 px-5 py-8 text-center text-base font-semibold text-slate-500">
              Nothing dated yet.
            </p>
          )}
        </div>
      </section>

      <MobileQuickAssignmentSheet
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        initialDate={selectedDate}
        onOpenCourse={onOpenCourse}
      />
    </div>
  );
}

function CalendarAssignmentRow({
  item,
  onOpenCourse,
  onComplete,
}: {
  item: CalendarItem;
  onOpenCourse: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <button
        type="button"
        className="min-w-0 flex-1 text-left active:scale-[0.99]"
        onClick={onOpenCourse}
      >
        <p className="truncate text-base font-black text-slate-950">
          {item.assignment.title}
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-500">
          {item.course.name} / {formatShortDate(item.assignment.dueDate)}
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-400">
          {item.folder ? folderDisplayName(item.folder) : "Unfiled"}
        </p>
      </button>
      {item.assignment.status === "completed" ? (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
        </span>
      ) : (
        <button
          type="button"
          className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-500 active:scale-[0.98]"
          onClick={onComplete}
          aria-label="Mark complete"
        >
          <Check className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

function MobileGpa({
  onOpenGpa,
}: {
  onOpenGpa: () => void;
}) {
  const report = useGpaReport();
  const yearRows = gpaYearRows(report);
  const sessionRows = gpaSessionRows(report);
  const waitingCount = gpaWaitingCourseCount(report);
  const rows = [...yearRows, ...sessionRows];

  return (
    <div className="space-y-4">
      <MobileGpaHero report={report} onOpenGpa={onOpenGpa} />
      <section className="rounded-[2rem] border border-white/70 bg-white/95 p-4 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Breakdown
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">
              GPA map
            </h1>
          </div>
          <button
            type="button"
            className="grid min-h-11 min-w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-600"
            onClick={onOpenGpa}
            aria-label="Open GPA details"
          >
            <CircleHelp className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 divide-y divide-slate-100">
          {rows.map((row) => (
            <div
              key={`${row.label}-${"id" in row ? row.id : row.key}`}
              className="flex min-h-[68px] items-center justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-base font-black text-slate-950">
                  {row.label}
                </p>
                <p className="mt-1 text-base font-semibold text-slate-500">
                  {averageDetail(row.result)}
                </p>
              </div>
              <p className="text-lg font-black tabular-nums text-slate-950">
                {row.result.displayAverage == null
                  ? "--"
                  : formatAverage(row.result)}
              </p>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="rounded-3xl border border-dashed border-slate-300 px-5 py-8 text-center text-base text-slate-500">
              Complete a course to unlock year and session breakdowns.
            </p>
          )}
        </div>
      </section>
      <section className="grid grid-cols-2 gap-3">
        <MobileMetric
          label="Credits"
          value={formatCredits(report.cumulative.creditsIncluded)}
          detail="Included now"
        />
        <MobileMetric
          label="Waiting"
          value={String(waitingCount)}
          detail="Need final marks"
        />
      </section>
    </div>
  );
}

function MobileGpaSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const report = useGpaReport();
  const yearRows = gpaYearRows(report);
  const sessionRows = gpaSessionRows(report);
  const help = GPA_POLICY_EXPLANATIONS[report.policy.id];
  const rows = [...yearRows, ...sessionRows];

  return (
    <MobileBottomSheet title="GPA breakdown" open={open} onClose={onClose}>
      <div className="rounded-3xl bg-slate-950 p-5 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">
          {report.policy.cumulativeAverageLabel}
        </p>
        <div className="mt-3 text-5xl font-black tracking-tight">
          {formatSchoolAverage(report)}
        </div>
        <p className="mt-2 text-base text-white/60">
          {averageDetail(report.cumulative)}
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div
            key={`${row.label}-${"id" in row ? row.id : row.key}`}
            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-800">
                {row.label}
              </p>
              <p className="mt-0.5 truncate text-base text-slate-500">
                {averageDetail(row.result)}
              </p>
            </div>
            <p className="text-lg font-black tabular-nums text-slate-950">
              {row.result.displayAverage == null
                ? "--"
                : formatAverage(row.result)}
            </p>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-base text-slate-500">
            No completed GPA periods yet.
          </p>
        )}
      </div>

      <div className="mt-5 rounded-3xl bg-slate-50 p-5">
        <h3 className="text-xl font-black tracking-tight">{help.title}</h3>
        <p className="mt-2 text-base leading-relaxed text-slate-600">
          {help.summary}
        </p>
        <div className="mt-4 space-y-3">
          {help.bullets.map((bullet) => (
            <p
              key={bullet}
              className="flex gap-3 text-base leading-relaxed text-slate-600"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <span>{bullet}</span>
            </p>
          ))}
        </div>
        {help.note && (
          <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-base font-semibold text-slate-500">
            {help.note}
          </p>
        )}
      </div>

      <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Grade scale
            </p>
            <h3 className="mt-1 text-xl font-black tracking-tight">
              Percent conversion
            </h3>
          </div>
          <ListChecks className="h-5 w-5 text-slate-400" />
        </div>
        <div className="mt-4 max-h-[46dvh] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Range</th>
                <th className="px-3 py-3">Letter</th>
                <th className="px-3 py-3 text-right">
                  {report.policy.scaleKind === "percent"
                    ? "Value"
                    : report.policy.scaleLabel}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.policy.gradeBands.map((band) => (
                <tr key={`${band.letter}-${band.minPercent}`}>
                  <td className="px-3 py-3 font-bold text-slate-700">
                    {formatGradeRange(band.minPercent, band.maxPercent)}
                  </td>
                  <td className="px-3 py-3 font-black text-slate-950">
                    {band.letter}
                  </td>
                  <td className="px-3 py-3 text-right font-black tabular-nums text-slate-950">
                    {formatScaleValue(band.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MobileBottomSheet>
  );
}

function MobileSemesterSheet({
  open,
  onClose,
  folder,
}: {
  open: boolean;
  onClose: () => void;
  folder: CourseFolder | null;
}) {
  const addFolder = useCourseStore((state) => state.addFolder);
  const renameFolder = useCourseStore((state) => state.renameFolder);
  const setFolderColor = useCourseStore((state) => state.setFolderColor);
  const removeFolder = useCourseStore((state) => state.removeFolder);
  const folders = useCourseStore((state) => state.folders);
  const [name, setName] = useState("");
  const [year, setYear] = useState<string>(semesterYears[0]);
  const [color, setColor] = useState<string>(semesterColors[0]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(folder?.name ?? "");
    setYear(folder?.year ?? semesterYears[0]);
    setColor(folder?.color ?? semesterColors[folders.length % semesterColors.length]);
    setError("");
  }, [folder, folders.length, open]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name the semester.");
      return;
    }
    if (folder) {
      renameFolder(folder.id, trimmed);
      setFolderColor(folder.id, color);
      useCourseStore.setState((state) => ({
        folders: state.folders.map((item) =>
          item.id === folder.id ? { ...item, year: year.trim() || undefined } : item
        ),
      }));
    } else {
      addFolder(trimmed, color, year.trim() || undefined);
    }
    onClose();
  };

  return (
    <MobileBottomSheet
      title={folder ? "Edit semester" : "New year"}
      open={open}
      onClose={onClose}
    >
      <div className="space-y-4">
        <MobileField
          label="Semester"
          hint="Use any name: Fall, Block 1, Term A, Summer."
        >
          <input
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Fall"
            onKeyDown={blurMobileInputOnEnter}
            onBlur={settleMobileInputAfterBlur}
          />
        </MobileField>
        <MobileField
          label="Year"
          hint="Custom mode can be anything: Year 1, Grade 12, Bootcamp."
        >
          <input
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            placeholder="Year 1"
            onKeyDown={blurMobileInputOnEnter}
            onBlur={settleMobileInputAfterBlur}
          />
        </MobileField>
        <MobileField label="Color">
          <div className="grid grid-cols-4 gap-2">
            {semesterColors.map((option) => (
              <button
                key={option}
                type="button"
                className={`min-h-12 rounded-2xl border ${
                  color === option ? "border-slate-950" : "border-slate-200"
                }`}
                style={{ backgroundColor: option }}
                onClick={() => setColor(option)}
                aria-label={`Use ${option}`}
              />
            ))}
          </div>
        </MobileField>
        {error && (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-base font-bold text-rose-700">
            {error}
          </p>
        )}
        <button
          type="button"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-base font-bold text-white shadow-soft active:scale-[0.98]"
          onClick={save}
        >
          <Check className="h-5 w-5" />
          {folder ? "Save semester" : "Create year"}
        </button>
        {folder && (
          <button
            type="button"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-base font-bold text-rose-700 active:scale-[0.98]"
            onClick={() => {
              removeFolder(folder.id);
              onClose();
            }}
          >
            <Trash2 className="h-5 w-5" />
            Delete semester
          </button>
        )}
      </div>
    </MobileBottomSheet>
  );
}

function MobileCourseSetupSheet({
  open,
  onClose,
  course,
  defaultCreditLabel,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  course: Course | null;
  defaultCreditLabel: string;
  onDeleted?: () => void;
}) {
  const folders = useCourseStore((state) => state.folders);
  const moveCourseToFolder = useCourseStore((state) => state.moveCourseToFolder);
  const updateCourse = useCourseStore((state) => state.updateCourse);
  const removeCourse = useCourseStore((state) => state.removeCourse);
  const folderName =
    course?.folderId == null
      ? "Unfiled"
      : folderDisplayName(
          folders.find((folder) => folder.id === course.folderId) ?? {
            id: course.folderId,
            name: "Semester",
            year: "",
            color: "#64748b",
          }
        );

  return (
    <MobileBottomSheet
      title="Course setup"
      open={open && course != null}
      onClose={onClose}
    >
      {course && (
        <div className="space-y-3">
          <div className="rounded-[1.5rem] border border-white/70 bg-slate-950 p-4 text-white shadow-soft">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">
              Editing
            </p>
            <h3 className="mt-1 truncate text-2xl font-black tracking-tight">
              {course.name}
            </h3>
            <p className="mt-1 text-sm font-semibold text-white/60">{folderName}</p>
          </div>

          <MobileField label="Semester">
            <select
              className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
              value={course.folderId ?? ""}
              onChange={(event) =>
                moveCourseToFolder(course.id, event.target.value || null)
              }
            >
              <option value="">Unfiled</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folderDisplayName(folder)}
                </option>
              ))}
            </select>
          </MobileField>

          <div className="grid grid-cols-2 gap-3">
            <MobileField label="Credit" hint={defaultCreditLabel}>
              <input
                className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                inputMode="decimal"
                value={course.creditWeight ?? ""}
                onChange={(event) => {
                  const value = parseFlexibleNumber(event.target.value);
                  updateCourse(course.id, {
                    creditWeight:
                      event.target.value === "" || value == null ? null : value,
                  });
                }}
                placeholder={defaultCreditLabel}
                aria-label={defaultCreditLabel}
              />
            </MobileField>
            <MobileField label="GPA mode">
              <select
                className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-base font-semibold text-slate-900 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                value={course.gradeMode ?? "graded"}
                onChange={(event) =>
                  updateCourse(course.id, {
                    gradeMode: event.target.value as GradeMode,
                  })
                }
              >
                {gradeModeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </MobileField>
          </div>

          <label className="flex min-h-11 items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-700">
            Count in GPA
            <input
              className="h-5 w-5 accent-slate-950"
              type="checkbox"
              checked={course.includeInGpa ?? true}
              onChange={(event) =>
                updateCourse(course.id, { includeInGpa: event.target.checked })
              }
            />
          </label>

          <button
            type="button"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-base font-bold text-rose-700 active:scale-[0.98]"
            onClick={() => {
              removeCourse(course.id);
              onClose();
              onDeleted?.();
            }}
          >
            <Trash2 className="h-5 w-5" />
            Delete course
          </button>
        </div>
      )}
    </MobileBottomSheet>
  );
}

function MobileSettings() {
  const appMode = useCourseStore((state) => state.appMode ?? "custom");
  const setAppMode = useCourseStore((state) => state.setAppMode);
  const universityThemeId = useCourseStore(
    (state) => state.universityThemeId ?? "uoft"
  );
  const setUniversityTheme = useCourseStore((state) => state.setUniversityTheme);
  const customThemeId = useCourseStore((state) => state.customThemeId ?? "classic");
  const setCustomTheme = useCourseStore((state) => state.setCustomTheme);
  const folders = useCourseStore((state) => state.folders);
  const [semesterSheet, setSemesterSheet] = useState<CourseFolder | null | "new">(null);

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-white/70 bg-white/95 p-4 shadow-soft backdrop-blur">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
          Settings
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">
          School and setup
        </h1>
        <div className="mt-5 grid grid-cols-2 gap-3 rounded-3xl bg-slate-100 p-1.5">
          {[
            { id: "custom", label: "Custom" },
            { id: "university", label: "University" },
          ].map((option) => {
            const active = appMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={`min-h-12 rounded-2xl text-base font-black ${
                  active ? "bg-white text-slate-950 shadow-soft" : "text-slate-500"
                }`}
                onClick={() => setAppMode(option.id as "custom" | "university")}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      {appMode === "university" ? (
        <>
          <section className="rounded-[2rem] border border-white/70 bg-white/95 p-4 shadow-soft backdrop-blur">
            <div className="mb-4 flex items-center gap-3">
              <GraduationCap className="h-6 w-6 text-slate-400" />
              <h2 className="text-2xl font-black tracking-tight">University</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {universityOptions.map((option) => {
                const active = universityThemeId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`min-h-14 rounded-2xl border px-3 text-base font-black ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                    onClick={() => setUniversityTheme(option.id)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="rounded-[2rem] border border-white/70 bg-white/95 p-4 shadow-soft backdrop-blur">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Semesters
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-3"
                >
                  <p className="text-xs font-black text-slate-400">
                    {folder.year}
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-800">
                    {folder.name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="rounded-[2rem] border border-white/70 bg-white/95 p-4 shadow-soft backdrop-blur">
            <div className="mb-4 flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-slate-400" />
              <h2 className="text-2xl font-black tracking-tight">Slates</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {customThemeOptions.map((option) => {
                const active = customThemeId === option.id;
                const preview = customSlatePreview(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`min-h-[4.6rem] rounded-2xl border p-3 text-left active:scale-[0.99] ${
                      active
                        ? "border-slate-950 text-slate-950 shadow-soft"
                        : "border-slate-200 text-slate-700"
                    }`}
                    style={{
                      background:
                        `linear-gradient(135deg, ${preview.wash}, #ffffff 58%, color-mix(in srgb, ${preview.accent} 10%, white))`,
                    }}
                    onClick={() => setCustomTheme(option.id)}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: preview.primary }}
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: preview.accent }}
                      />
                    </span>
                    <span className="mt-2 block text-sm font-black leading-tight">
                      {option.label}
                    </span>
                    {active && (
                      <span className="mt-1 block text-[0.68rem] font-black uppercase tracking-wide text-slate-400">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="rounded-[2rem] border border-white/70 bg-white/95 p-4 shadow-soft backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Semesters
                </p>
                <h2 className="text-xl font-black tracking-tight">
                  Years and terms
                </h2>
              </div>
              <button
                type="button"
                className="grid min-h-12 min-w-12 place-items-center rounded-2xl bg-slate-950 text-white active:scale-[0.98]"
                onClick={() => setSemesterSheet("new")}
                aria-label="Add semester"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left active:scale-[0.99]"
                  onClick={() => setSemesterSheet(folder)}
                >
                  <span
                    className="h-10 w-2 rounded-full"
                    style={{ backgroundColor: folder.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-black text-slate-950">
                      {folderDisplayName(folder)}
                    </span>
                    <span className="block text-sm font-semibold text-slate-500">
                      Tap to edit
                    </span>
                  </span>
                  <Edit3 className="h-4 w-4 text-slate-400" />
                </button>
              ))}
              {folders.length === 0 && (
                <p className="rounded-3xl border border-dashed border-slate-300 px-5 py-8 text-center text-base font-semibold text-slate-500">
                  Add your first year and semester. Custom mode stays blank until
                  you decide the structure.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      <MobileSemesterSheet
        open={semesterSheet != null}
        onClose={() => setSemesterSheet(null)}
        folder={semesterSheet === "new" ? null : semesterSheet}
      />
    </div>
  );
}

export default function MobileApp() {
  const [activeTab, setActiveTab] = useState<MobileTab>("dashboard");
  const [gpaOpen, setGpaOpen] = useState(false);
  const [courseCreateOpen, setCourseCreateOpen] = useState(false);
  const [courseCreateFolderId, setCourseCreateFolderId] = useState<string | null>(
    null
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const appMode = useCourseStore((state) => state.appMode ?? "custom");
  const folders = useCourseStore((state) => state.folders);
  const setAppMode = useCourseStore((state) => state.setAppMode);
  const universityThemeId = useCourseStore(
    (state) => state.universityThemeId ?? "uoft"
  );
  const customThemeId = useCourseStore((state) => state.customThemeId ?? "classic");
  const activeTheme = getActiveTheme(appMode, universityThemeId, customThemeId);
  const brandPalette = getMarkMateBrandPalette(
    appMode,
    universityThemeId,
    customThemeId
  );

  const showCourseDetail = activeTab === "courses" && selectedCourseId;
  const activeLabel =
    mobileTabs.find((tab) => tab.id === activeTab)?.label ?? "MarkMate";

  const openCourse = (courseId: string) => {
    setActiveTab("courses");
    setSelectedCourseId(courseId);
  };

  const openCourseCreate = (folderId?: string | null) => {
    setCourseCreateFolderId(folderId ?? null);
    setCourseCreateOpen(true);
  };
  const goToTab = (tab: MobileTab) => {
    setSelectedCourseId(null);
    setActiveTab(tab);
  };
  const goToNextTab = () => {
    setSelectedCourseId(null);
    setActiveTab((current) => {
      const index = mobileTabs.findIndex((tab) => tab.id === current);
      if (index < 0 || index >= mobileTabs.length - 1) return current;
      return mobileTabs[index + 1].id;
    });
  };
  const goToPreviousTab = () => {
    setSelectedCourseId(null);
    setActiveTab((current) => {
      const index = mobileTabs.findIndex((tab) => tab.id === current);
      if (index <= 0) return current;
      return mobileTabs[index - 1].id;
    });
  };
  const tabSwipeHandlers = useHorizontalSwipeNavigation(
    goToNextTab,
    goToPreviousTab,
    !showCourseDetail && !courseCreateOpen && !gpaOpen
  );

  const hasUniversitySemesterLayout = useMemo(
    () =>
      semesterYears.every((year) =>
        semesterTerms.every((term) =>
          folders.some((folder) => folder.year === year && folder.name === term)
        )
      ),
    [folders]
  );

  useEffect(() => {
    if (appMode === "university" && !hasUniversitySemesterLayout) {
      setAppMode("university");
    }
  }, [appMode, hasUniversitySemesterLayout, setAppMode]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [activeTab, selectedCourseId]);

  return (
    <div
      className="app-shell min-h-[100dvh] overscroll-none bg-slate-50 text-slate-950"
      data-app-mode={appMode}
      data-theme-id={activeTheme.id}
      style={
        {
          "--theme-bg-image": activeTheme.backgroundImage
            ? `url(${activeTheme.backgroundImage})`
            : "none",
          "--theme-primary": activeTheme.primaryColor,
          "--theme-accent": activeTheme.accentColor,
          "--theme-overlay": activeTheme.overlay,
          "--theme-bg-position": activeTheme.position ?? "left top",
          "--markmate-logo-primary": brandPalette.logoPrimary,
          "--markmate-logo-accent": brandPalette.logoAccent,
          "--markmate-word-start": brandPalette.wordStart,
          "--markmate-word-mid": brandPalette.wordMid,
          "--markmate-word-end": brandPalette.wordEnd,
        } as React.CSSProperties
      }
    >
      <main
        className="mx-auto min-h-[100dvh] w-full max-w-md px-5 pb-28 pt-[calc(env(safe-area-inset-top)+0.6rem)]"
        {...tabSwipeHandlers}
      >
        {!showCourseDetail && (
          <header className="sticky top-0 z-20 -mx-5 mb-4 border-b border-white/70 bg-white/86 px-5 pb-3 pt-[calc(env(safe-area-inset-top)+0.6rem)] shadow-[0_16px_42px_-34px_rgba(15,23,42,0.5)] backdrop-blur">
            <div className="flex items-center gap-3">
              <MobileSchoolMark
                themeId={appMode === "university" ? activeTheme.id : "markmate"}
                label={activeTheme.label}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  {activeTheme.label}
                </p>
                <h1 className="truncate text-xl font-black tracking-tight">
                  {activeLabel}
                </h1>
              </div>
            </div>
          </header>
        )}

        {showCourseDetail ? (
          <MobileCourseDetail
            courseId={selectedCourseId}
            onBack={() => setSelectedCourseId(null)}
          />
        ) : activeTab === "dashboard" ? (
          <MobileDashboard
            onOpenGpa={() => setGpaOpen(true)}
            onOpenCourse={openCourse}
            onAddCourse={() => openCourseCreate()}
            onGoCalendar={() => {
              setSelectedCourseId(null);
              setActiveTab("calendar");
            }}
            onGoCourses={() => {
              setSelectedCourseId(null);
              setActiveTab("courses");
            }}
          />
        ) : activeTab === "courses" ? (
          <MobileCourses
            onOpenCourse={setSelectedCourseId}
            onAddCourse={openCourseCreate}
          />
        ) : activeTab === "calendar" ? (
          <MobileCalendar onOpenCourse={openCourse} />
        ) : activeTab === "gpa" ? (
          <MobileGpa onOpenGpa={() => setGpaOpen(true)} />
        ) : (
          <MobileSettings />
        )}
      </main>

      {!showCourseDetail && (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-white/70 bg-white/90 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 shadow-[0_-18px_44px_-28px_rgba(15,23,42,0.45)] backdrop-blur"
          style={{ position: "fixed", zIndex: 20 }}
        >
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
            {mobileTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[0.68rem] font-bold transition focus:outline-none active:scale-[0.98] ${
                    active ? "text-white" : "bg-transparent text-slate-500"
                  }`}
                  style={{
                    backgroundColor: active ? activeTheme.primaryColor : "transparent",
                    WebkitTapHighlightColor: "transparent",
                  }}
                  onClick={() => goToTab(tab.id)}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <MobileGpaSheet open={gpaOpen} onClose={() => setGpaOpen(false)} />
      <MobileCourseCreateSheet
        open={courseCreateOpen}
        onClose={() => {
          setCourseCreateOpen(false);
          setCourseCreateFolderId(null);
        }}
        onCreated={openCourse}
        initialFolderId={courseCreateFolderId}
      />
    </div>
  );
}
