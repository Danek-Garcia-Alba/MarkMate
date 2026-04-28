import React, { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Copy,
  Filter,
  Folder,
  FolderPlus,
  Gauge,
  Info,
  LayoutDashboard,
  ListPlus,
  Medal,
  Pencil,
  PartyPopper,
  Plus,
  Rocket,
  Save,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { MarkMateLogo } from "../MarkMateLogo";
import {
  calculateUniversityReport,
  formatAverage,
  getUniversityPolicy,
  toCourseGradeRecordFromMarkMateCourse,
  type AverageResult,
  type CourseGradeRecord,
  type GradeMode,
  type UniversityGpaReport,
  type UniversityId,
} from "../../lib/gpa";

/* ==========================
   Types
========================== */
export type AssignmentStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "overdue";

export type Assignment = {
  id: string;
  title: string;
  dueDate: string | null;
  weight: number;
  status: AssignmentStatus;
  grade: number | null;
  late?: boolean;
  latePenalty?: number;
};

export type Course = {
  id: string;
  name: string;
  assignments: Assignment[];
  color?: string;
  folderId?: string | null;
  creditWeight?: number | null;
  gradeMode?: GradeMode;
  includeInGpa?: boolean;
  repeatGroupId?: string;
  attempt?: number | null;
  completedAt?: string;
  transcriptResult?: string;
};

export type CourseFolder = {
  id: string;
  name: string;
  color: string;
  year?: string;
  collapsed?: boolean;
};

type CalendarTheme =
  | "system"
  | "pastel"
  | "highContrast"
  | "minimal"
  | "academic"
  | "deadline";
type UniversityThemeId =
  | "markmate"
  | "uoft"
  | "western"
  | "queens"
  | "york"
  | "tmu"
  | "waterloo"
  | "laurier"
  | "brock"
  | "guelph"
  | "uottawa"
  | "mcgill";
type AppMode = "university" | "custom";
type CustomThemeId = "classic" | "bloom" | "circuit" | "meadow";

type AssignmentDraft = Omit<Assignment, "id">;
type AssignmentMode = "single" | "bulk";
type FolderFilter = "all" | "unfiled" | string;

/* ==========================
   Helpers
========================== */
const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#e11d48",
  "#6366f1",
] as const;

const FOLDER_COLORS = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#be123c",
  "#c2410c",
  "#4d7c0f",
  "#0369a1",
  "#52525b",
] as const;

const DEFAULT_YEAR_LABELS = ["Year 1", "Year 2", "Year 3", "Year 4"] as const;

const DEFAULT_TERM_LABELS = ["Fall", "Winter", "Summer"] as const;

const LEGACY_DEFAULT_SEMESTERS = [
  "Year 1 Sem 1",
  "Year 1 Sem 2",
  "Year 2 Sem 1",
  "Year 2 Sem 2",
] as const;

type UniversityTheme = {
  id: UniversityThemeId;
  label: string;
  name: string;
  backgroundImage: string;
  primaryColor: string;
  accentColor: string;
  overlay: string;
  position?: string;
};

type CustomTheme = {
  id: CustomThemeId;
  label: string;
  tagline: string;
  backgroundImage: string;
  primaryColor: string;
  accentColor: string;
  overlay: string;
  position?: string;
};

export const GPA_POLICY_EXPLANATIONS: Record<
  UniversityId,
  {
    title: string;
    summary: string;
    bullets: string[];
    note?: string;
  }
> = {
  uoft: {
    title: "How UofT GPA is estimated",
    summary:
      "MarkMate estimates UofT CGPA, AGPA, and SGPA on the 4.0 scale using each course's grade point value and credit weight.",
    bullets: [
      "Formula: sum of grade points times credit weight, divided by attempted credits with grade points.",
      "Half-credit courses normally weigh 0.5 and full-credit courses normally weigh 1.0.",
      "SGPA is calculated separately for Fall, Winter, and Summer. AGPA is shown as Fall/Winter. CGPA uses all applicable completed courses.",
      "MarkMate does not invent a pre-conversion rounding step for UofT; it treats your entered final result as the posted course result.",
      "CR/NCR is normally excluded. If an NCR is officially GPA-counting, enter NC%; MarkMate counts NC% as 0.0.",
      "Repeats vary by campus/division and transcript notation, so MarkMate does not auto-drop UofT repeats. Mark EXT/Extra or excluded attempts manually when your transcript says so.",
      "Professional divisions can use different rules, so this is the standard undergraduate default.",
    ],
  },
  tmu: {
    title: "How TMU GPA is estimated",
    summary:
      "MarkMate estimates TMU CGPA and TGPA on the 4.33 GPA scale using course weight times grade points.",
    bullets: [
      "Final percentage grades are rounded to the nearest integer before conversion: 49.5 becomes 50, while 49.4 stays 49.",
      "Formula: sum of course weight times grade points, divided by total course weight.",
      "One-term courses usually count as 1.00 weight, and two-term courses usually count as 2.00.",
      "TGPA and CGPA are rounded normally to two decimals.",
      "Repeated courses use the most recent attempt, even if the newer mark is lower; earlier attempts stay on the transcript but leave the GPA calculation.",
      "F, F-S, FS, and FNA count as 0.00 grade points.",
      "Non-graded designations such as CRT, NCR, PSD, AEG, INC, and transfer-style results are excluded.",
    ],
  },
  western: {
    title: "How Western GPA is estimated",
    summary:
      "Western does not issue a GPA. MarkMate estimates Western-style weighted percentage averages instead.",
    bullets: [
      "The estimate is a credit-weighted percentage average, not a point GPA.",
      "Formula: sum of credit weight times numeric grade, divided by total counted credit weight.",
      "Grades below 40 are calculated as 40. Grades from 40 to 49 use the actual reported grade.",
      "A late drop with academic penalty is recorded as F and calculated as 40 for averages.",
      "Repeated courses use the most recent attempt for cumulative and progression-style averages; earlier attempts remain on the transcript as no-credit repeats.",
      "Pass, credit, audit, withdrawal, transfer, and similar non-numeric results are excluded.",
    ],
  },
  queens: {
    title: "How Queen's GPA is estimated",
    summary:
      "MarkMate estimates Queen's term, academic-year, and cumulative GPA on the 4.3 scale.",
    bullets: [
      "GPA is calculated from grade points divided by total GPA units.",
      "Academic-year GPA includes completed Fall, Winter, and Summer courses in that year.",
      "If a course is repeated, only the highest grade-bearing attempt is used.",
      "Personal Interest Credit P is excluded from GPA; a failing F remains a normal 0.0 unless a separate faculty-specific rule applies.",
      "CR, P, DR, NG, audit, transfer, and incomplete-style results are excluded. Failed grade-bearing attempts count unless replaced by a higher repeat.",
      "Teacher Education and Law have separate scales, so this is the standard undergraduate default.",
    ],
  },
  guelph: {
    title: "How Guelph GPA is estimated",
    summary:
      "Guelph uses weighted percentage averages, so MarkMate estimates semester, academic-year, and cumulative averages.",
    bullets: [
      "Formula: weighted course total divided by credit attempts. Semester average uses that semester; cumulative average uses all counted semesters.",
      "Numeric final percentages are used directly, including numeric failing marks.",
      "Credit/No Credit and alternative evaluation symbols are excluded from averages.",
      "Transcript symbols like F, WF, or XXF are not treated as automatic zero values.",
      "If you have an actual numeric failing mark, enter that percentage instead of only entering the symbol.",
      "For courses from Summer 2026 onward, repeated attempts still count in the semester average, but only the highest grade counts in cumulative average.",
      "For courses before Summer 2026, MarkMate does not apply the new highest-grade repeat rule retroactively unless the completed dates show the new rule applies.",
      "No institution-wide pre-conversion rounding step is applied.",
    ],
  },
  brock: {
    title: "How Brock GPA is estimated",
    summary:
      "MarkMate estimates Brock's official-style weighted percentage average and displays it as a whole percent.",
    bullets: [
      "The average is credit weight times numeric grade, divided by attempted credits.",
      "The final average is rounded to the nearest whole percentage point.",
      "Grades below 45 calculate as 45. F grades from 46 to 49 use the actual numeric value.",
      "If a course is retaken, the later attempt counts whether it is higher or lower.",
      "Letter of Permission coursework is treated as Pass/Fail and excluded from Brock average calculations.",
      "Pass, credit, audit, incomplete, transfer, and similar non-average results are excluded.",
    ],
  },
  york: {
    title: "How York GPA is estimated",
    summary:
      "MarkMate estimates York cumulative, sessional, and academic-year GPA on the 9-point letter-grade scale.",
    bullets: [
      "The estimate is credit-weighted from letter grade point value times course credit value.",
      "Percent ranges are only guideline conversions; York's official GPA system is fundamentally letter-grade based.",
      "Only York courses are included in York GPAs.",
      "Only the most recent completed repeat attempt counts toward GPA.",
      "Ordinary F counts as 0. Pass/Fail option P and F grades do not affect GPA.",
    ],
  },
  waterloo: {
    title: "How Waterloo GPA is estimated",
    summary:
      "Waterloo uses numeric percentage grades, so MarkMate estimates weighted percentage averages.",
    bullets: [
      "Formula: counted course credit weight times numeric grade, divided by total counted course credit weight.",
      "Grades from 0 to 32 are calculated as 32 for average purposes.",
      "FTC, NMR, DNW, and WF also calculate as 32 when entered as transcript results.",
      "CR is excluded. NCR is treated as a failed course but is not included in any average calculation.",
      "Repeat rules are faculty and plan specific, so MarkMate keeps all grade-bearing attempts unless you manually exclude one.",
    ],
  },
  laurier: {
    title: "How Laurier GPA is estimated",
    summary:
      "MarkMate estimates Laurier term, year, and cumulative GPA on the 12-point scale.",
    bullets: [
      "GPA is weighted grade points divided by credits attempted.",
      "Laurier GPAs are rounded normally to two decimal places.",
      "Repeated courses use the second or later attempt in GPA, even if the later mark is lower.",
      "F, XF, and DR count as zero GPA values.",
      "WD, CR, S/U-style, transfer, incomplete, and similar non-GPA results are excluded from GPA credit totals.",
      "Standard degree repeat limits and general-degree exceptions can vary, so manually exclude attempts if your registrar record treats them differently.",
    ],
  },
  uottawa: {
    title: "How uOttawa GPA is estimated",
    summary:
      "MarkMate estimates uOttawa CGPA and TGPA on the 10-point alphanumeric scale.",
    bullets: [
      "Final course percentages are rounded to the nearest integer before grade-point conversion.",
      "Grade points are course units times numeric grade value, divided by total units.",
      "CGPA and TGPA are rounded to two decimals.",
      "Only the last grade of a repeated course counts in CGPA, even if a failing grade replaces a passing one.",
      "CR, NC, P, S, NS, transfer, and deferred-style results are excluded. ABS and EIN count as F/0.",
      "Some faculties/programs have higher passing thresholds, but the grade-point mapping remains the standard undergraduate scale unless your program publishes a variant.",
    ],
  },
  mcgill: {
    title: "How McGill GPA is estimated",
    summary:
      "MarkMate estimates McGill CGPA and TGPA on the 4.0 scale and truncates the displayed value to two decimals.",
    bullets: [
      "GPA is course credits times grade points, divided by GPA course credits.",
      "Repeated course grades all remain in CGPA, even though credit is granted only once.",
      "Approved P/F courses exclude P but include F. Student-selected S/U grades are excluded from GPA, including U.",
      "J and KF count as failures worth 0. W, WF, WL, K-style, transfer, and unresolved incomplete results are excluded.",
      "Engineering and Law can differ from the standard numeric correspondence, so this is the standard undergraduate default.",
    ],
  },
};

const UNIVERSITY_THEMES: Record<UniversityThemeId, UniversityTheme> = {
  markmate: {
    id: "markmate",
    label: "MarkMate",
    name: "MarkMate",
    backgroundImage: "",
    primaryColor: "#0f172a",
    accentColor: "#0ea5e9",
    overlay: "rgba(248, 250, 252, 0.88)",
  },
  uoft: {
    id: "uoft",
    label: "U of T",
    name: "University of Toronto",
    backgroundImage: "/themes/uoft-theme.png",
    primaryColor: "#002A5C",
    accentColor: "#D4AF37",
    overlay: "rgba(241, 247, 255, 0.88)",
    position: "left top",
  },
  western: {
    id: "western",
    label: "Western",
    name: "Western University",
    backgroundImage: "/themes/western-theme.png",
    primaryColor: "#4F2683",
    accentColor: "#FFFFFF",
    overlay: "rgba(248, 245, 255, 0.88)",
  },
  queens: {
    id: "queens",
    label: "Queen's",
    name: "Queen's University",
    backgroundImage: "/themes/queens-theme.png",
    primaryColor: "#00305E",
    accentColor: "#FDB515",
    overlay: "rgba(244, 249, 255, 0.88)",
  },
  york: {
    id: "york",
    label: "York",
    name: "York University",
    backgroundImage: "/themes/york-theme.png",
    primaryColor: "#E31837",
    accentColor: "#FFFFFF",
    overlay: "rgba(255, 246, 247, 0.9)",
  },
  tmu: {
    id: "tmu",
    label: "TMU",
    name: "Toronto Metropolitan University",
    backgroundImage: "/themes/tmu-theme.png",
    primaryColor: "#0055A4",
    accentColor: "#FFD200",
    overlay: "rgba(244, 249, 255, 0.88)",
  },
  waterloo: {
    id: "waterloo",
    label: "Waterloo",
    name: "University of Waterloo",
    backgroundImage: "/themes/waterloo-theme.png",
    primaryColor: "#111111",
    accentColor: "#F2C300",
    overlay: "rgba(248, 248, 246, 0.9)",
  },
  laurier: {
    id: "laurier",
    label: "Laurier",
    name: "Wilfrid Laurier University",
    backgroundImage: "/themes/laurier-theme.png",
    primaryColor: "#4B2682",
    accentColor: "#FDB913",
    overlay: "rgba(248, 245, 255, 0.88)",
  },
  brock: {
    id: "brock",
    label: "Brock",
    name: "Brock University",
    backgroundImage: "/themes/brock-theme.png",
    primaryColor: "#D71920",
    accentColor: "#FFFFFF",
    overlay: "rgba(255, 246, 246, 0.9)",
  },
  guelph: {
    id: "guelph",
    label: "Guelph",
    name: "University of Guelph",
    backgroundImage: "/themes/guelph-theme.png",
    primaryColor: "#123D2A",
    accentColor: "#D4AF37",
    overlay: "rgba(248, 248, 248, 0.9)",
  },
  uottawa: {
    id: "uottawa",
    label: "uOttawa",
    name: "uOttawa",
    backgroundImage: "/themes/uottawa-theme.png",
    primaryColor: "#8A1538",
    accentColor: "#FFFFFF",
    overlay: "rgba(255, 247, 249, 0.88)",
  },
  mcgill: {
    id: "mcgill",
    label: "McGill",
    name: "McGill University",
    backgroundImage: "/themes/mcgill-theme.png",
    primaryColor: "#ED1B2F",
    accentColor: "#FFFFFF",
    overlay: "rgba(255, 247, 247, 0.9)",
  },
};

const UNIVERSITY_THEME_OPTIONS = Object.values(UNIVERSITY_THEMES);
const REAL_UNIVERSITY_THEME_OPTIONS = UNIVERSITY_THEME_OPTIONS.filter(
  (theme) => theme.id !== "markmate"
);

const CUSTOM_THEMES: Record<CustomThemeId, CustomTheme> = {
  classic: {
    id: "classic",
    label: "Studio Slate",
    tagline: "Clean, focused, and quietly premium.",
    backgroundImage: "",
    primaryColor: "#0f172a",
    accentColor: "#0ea5e9",
    overlay: "rgba(248, 250, 252, 0.9)",
  },
  bloom: {
    id: "bloom",
    label: "Bloom",
    tagline: "Soft rose, mint, and warm study-room light.",
    backgroundImage: "",
    primaryColor: "#be123c",
    accentColor: "#0f766e",
    overlay: "rgba(255, 247, 250, 0.9)",
  },
  circuit: {
    id: "circuit",
    label: "Circuit",
    tagline: "Crisp blue notes with a technical edge.",
    backgroundImage: "",
    primaryColor: "#1d4ed8",
    accentColor: "#475569",
    overlay: "rgba(244, 248, 255, 0.9)",
  },
  meadow: {
    id: "meadow",
    label: "Meadow",
    tagline: "Green, grounded, and calmer than your inbox.",
    backgroundImage: "",
    primaryColor: "#166534",
    accentColor: "#b45309",
    overlay: "rgba(246, 252, 247, 0.9)",
  },
};

const CUSTOM_THEME_OPTIONS = Object.values(CUSTOM_THEMES);

type MarkMateBrandPalette = {
  logoPrimary: string;
  logoAccent: string;
  wordStart: string;
  wordMid: string;
  wordEnd: string;
};

const CUSTOM_MARKMATE_BRAND: MarkMateBrandPalette = {
  logoPrimary: "#fb7185",
  logoAccent: "#34d399",
  wordStart: "#ec4899",
  wordMid: "#fb7185",
  wordEnd: "#10b981",
};

const UNIVERSITY_MARKMATE_BRANDS: Record<UniversityThemeId, MarkMateBrandPalette> = {
  markmate: CUSTOM_MARKMATE_BRAND,
  uoft: {
    logoPrimary: "#002A5C",
    logoAccent: "#0ea5e9",
    wordStart: "#002A5C",
    wordMid: "#0369a1",
    wordEnd: "#0ea5e9",
  },
  western: {
    logoPrimary: "#4F2683",
    logoAccent: "#b7a6d8",
    wordStart: "#4F2683",
    wordMid: "#6d28d9",
    wordEnd: "#b7a6d8",
  },
  queens: {
    logoPrimary: "#00305E",
    logoAccent: "#FDB515",
    wordStart: "#00305E",
    wordMid: "#B90E31",
    wordEnd: "#C99700",
  },
  york: {
    logoPrimary: "#E31837",
    logoAccent: "#111827",
    wordStart: "#E31837",
    wordMid: "#9f1239",
    wordEnd: "#111827",
  },
  tmu: {
    logoPrimary: "#0055A4",
    logoAccent: "#FFD200",
    wordStart: "#0055A4",
    wordMid: "#0077C8",
    wordEnd: "#C99700",
  },
  waterloo: {
    logoPrimary: "#111827",
    logoAccent: "#F2C300",
    wordStart: "#111827",
    wordMid: "#D69E00",
    wordEnd: "#F2C300",
  },
  laurier: {
    logoPrimary: "#4B2682",
    logoAccent: "#FDB913",
    wordStart: "#4B2682",
    wordMid: "#6d28d9",
    wordEnd: "#C99700",
  },
  brock: {
    logoPrimary: "#D71920",
    logoAccent: "#64748b",
    wordStart: "#D71920",
    wordMid: "#991b1b",
    wordEnd: "#475569",
  },
  guelph: {
    logoPrimary: "#123D2A",
    logoAccent: "#D4AF37",
    wordStart: "#123D2A",
    wordMid: "#7A0019",
    wordEnd: "#A47D12",
  },
  uottawa: {
    logoPrimary: "#8A1538",
    logoAccent: "#94a3b8",
    wordStart: "#8A1538",
    wordMid: "#111827",
    wordEnd: "#64748b",
  },
  mcgill: {
    logoPrimary: "#ED1B2F",
    logoAccent: "#64748b",
    wordStart: "#ED1B2F",
    wordMid: "#9f1239",
    wordEnd: "#475569",
  },
};

export function getActiveTheme(
  appMode: AppMode,
  universityThemeId: UniversityThemeId,
  customThemeId: CustomThemeId
): UniversityTheme | CustomTheme {
  if (appMode === "university") {
    const id = universityThemeId === "markmate" ? "uoft" : universityThemeId;
    return UNIVERSITY_THEMES[id] ?? UNIVERSITY_THEMES.uoft;
  }
  return CUSTOM_THEMES[customThemeId] ?? CUSTOM_THEMES.classic;
}

export function getMarkMateBrandPalette(
  appMode: string,
  universityThemeId: string,
  _customThemeId: string
): MarkMateBrandPalette {
  if (appMode !== "university") return CUSTOM_MARKMATE_BRAND;
  const id = universityThemeId === "markmate" ? "uoft" : universityThemeId;
  return (
    UNIVERSITY_MARKMATE_BRANDS[id as UniversityThemeId] ??
    UNIVERSITY_MARKMATE_BRANDS.uoft
  );
}

const STATUS_LABEL: Record<AssignmentStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  overdue: "Overdue",
};

const STATUS_ORDER: Record<AssignmentStatus, number> = {
  overdue: 0,
  in_progress: 1,
  not_started: 2,
  completed: 3,
};

export function normalizeWeightToPercent(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  if (raw <= 1) return clamp(raw * 100);
  return clamp(raw);
}

function effectiveGrade(a: Assignment): number | null {
  if (a.grade == null) return null;
  const penalty = a.late ? a.latePenalty ?? 10 : 0;
  return clamp(a.grade - penalty);
}

function sumWeights(assignments: Assignment[]) {
  return assignments.reduce((sum, a) => sum + normalizeWeightToPercent(a.weight), 0);
}

function isPast(dateISO: string | null): boolean {
  if (!dateISO) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dateISO}T00:00:00`);
  return due.getTime() < today.getTime();
}

function daysUntil(dateISO: string | null): number | null {
  if (!dateISO) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dateISO}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / DAY_MS);
}

function formatDueDate(dateISO: string | null) {
  if (!dateISO) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateISO}T00:00:00`));
}

function dueTone(dateISO: string | null, status: AssignmentStatus) {
  if (status === "completed") return "success";
  const days = daysUntil(dateISO);
  if (days == null) return "default";
  if (days < 0) return "danger";
  if (days <= 3) return "warning";
  return "info";
}

function dueLabel(dateISO: string | null, status: AssignmentStatus) {
  if (!dateISO) return "No date";
  if (status === "completed") return formatDueDate(dateISO);
  const days = daysUntil(dateISO);
  if (days == null) return formatDueDate(dateISO);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days}d`;
}

function compareDue(a: Assignment, b: Assignment) {
  return (a.dueDate ?? "9999-12-31").localeCompare(
    b.dueDate ?? "9999-12-31"
  );
}

export function folderDisplayName(folder: CourseFolder | null) {
  if (!folder) return "No semester";
  return folder.year ? `${folder.year} / ${folder.name}` : folder.name;
}

function searchKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function editDistanceWithin(a: string, b: string, maxDistance = 1) {
  if (!a || !b) return false;
  if (Math.abs(a.length - b.length) > maxDistance) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      );
      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > maxDistance) return false;
    previous = current;
  }
  return previous[b.length] <= maxDistance;
}

export function smartSearchMatch(values: Array<string | null | undefined>, query: string) {
  const rawQuery = query.trim().toLowerCase();
  if (!rawQuery) return true;
  const compactQuery = searchKey(rawQuery);
  const queryParts = rawQuery
    .split(/[^a-z0-9]+/i)
    .map(searchKey)
    .filter(Boolean);

  return values.some((value) => {
    if (!value) return false;
    const rawValue = value.toLowerCase();
    const compactValue = searchKey(rawValue);
    if (rawValue.includes(rawQuery) || compactValue.includes(compactQuery)) {
      return true;
    }
    const valueParts = rawValue
      .split(/[^a-z0-9]+/i)
      .map(searchKey)
      .filter(Boolean);
    return queryParts.every((part) =>
      valueParts.some(
        (candidate) =>
          candidate.includes(part) ||
          part.includes(candidate) ||
          editDistanceWithin(candidate, part, part.length >= 5 ? 2 : 1)
      )
    );
  });
}

function folderChronology(folder: CourseFolder | null) {
  if (!folder) return 9999;
  const yearMatch = folder.year?.match(/\d+/);
  const yearIndex = yearMatch ? Number(yearMatch[0]) - 1 : 99;
  const termIndex = DEFAULT_TERM_LABELS.findIndex((term) => term === folder.name);
  return yearIndex * 10 + (termIndex >= 0 ? termIndex : 9);
}

export function courseChronology(
  course: Course,
  foldersById: Map<string, CourseFolder>
) {
  const folder = course.folderId ? foldersById.get(course.folderId) ?? null : null;
  return folderChronology(folder);
}

function nextDue(assignments: Assignment[]): Assignment | null {
  const upcoming = assignments
    .filter((a) => a.dueDate && a.status !== "completed")
    .filter((a) => !isPast(a.dueDate))
    .sort(compareDue);
  return upcoming[0] ?? null;
}

export function calcMetrics(course: Course) {
  const completedAssignments = course.assignments.filter(
    (a) => a.status === "completed"
  );
  const completedWeighted = sumWeights(completedAssignments);
  const totalWeights = sumWeights(course.assignments);

  const gradedCompleted = completedAssignments.filter(
    (a) => effectiveGrade(a) != null
  );
  const gradedWeight = sumWeights(gradedCompleted);
  const gradedEarned = gradedCompleted.reduce((sum, a) => {
    const w = normalizeWeightToPercent(a.weight);
    return sum + (w * effectiveGrade(a)!) / 100;
  }, 0);

  const gradeSoFar =
    gradedWeight > 0 ? (gradedEarned / gradedWeight) * 100 : null;

  const currentMark = course.assignments.reduce((sum, a) => {
    const w = normalizeWeightToPercent(a.weight);
    return sum + (w * (effectiveGrade(a) ?? 0)) / 100;
  }, 0);

  return {
    completedWeighted,
    displayCompleted: clamp(completedWeighted),
    gradeSoFar,
    currentMark,
    totalWeights,
  };
}

export function selectedUniversityId(themeId: UniversityThemeId): UniversityId {
  return themeId === "markmate" ? "uoft" : themeId;
}

function academicYearFromFolder(folder: CourseFolder | null): 1 | 2 | 3 | 4 {
  const match = folder?.year?.match(/\d+/);
  const year = match ? Number(match[0]) : 1;
  return year === 2 || year === 3 || year === 4 ? year : 1;
}

function academicTermFromFolder(folder: CourseFolder | null) {
  if (
    folder?.name === "Fall" ||
    folder?.name === "Winter" ||
    folder?.name === "Summer"
  ) {
    return folder.name;
  }
  return "Fall";
}

function deriveCourseFinalPercent(course: Course): number | null {
  const weightedAssignments = course.assignments.filter(
    (assignment) => normalizeWeightToPercent(assignment.weight) > 0
  );
  if (weightedAssignments.length === 0) return null;

  const totalWeight = sumWeights(weightedAssignments);
  if (Math.abs(totalWeight - 100) > 0.01) return null;

  if (weightedAssignments.some((assignment) => effectiveGrade(assignment) == null)) {
    return null;
  }

  const weightedGradeTotal = weightedAssignments.reduce((sum, assignment) => {
    return sum + normalizeWeightToPercent(assignment.weight) * effectiveGrade(assignment)!;
  }, 0);

  return clamp(weightedGradeTotal / totalWeight);
}

export function buildCourseGradeRecords(
  courses: Course[],
  foldersById: Map<string, CourseFolder>,
  universityId: UniversityId
): CourseGradeRecord[] {
  return courses.map((course) => {
    const folder = course.folderId ? foldersById.get(course.folderId) ?? null : null;
    const transcriptResult = course.transcriptResult?.trim();
    const finalPercent = transcriptResult ? null : deriveCourseFinalPercent(course);

    return toCourseGradeRecordFromMarkMateCourse({
      id: course.id,
      code: course.name,
      name: course.name,
      year: academicYearFromFolder(folder),
      term: academicTermFromFolder(folder),
      creditWeight: course.creditWeight ?? undefined,
      finalPercent,
      finalLetter: transcriptResult || undefined,
      includeInGpa: course.includeInGpa,
      status: transcriptResult || finalPercent != null ? "completed" : "in-progress",
      gradeMode: course.gradeMode ?? "graded",
      repeatGroupId: course.repeatGroupId?.trim() || undefined,
      attempt: course.attempt ?? undefined,
      completedAt: course.completedAt || undefined,
    });
  });
}

export function formatSchoolAverage(report: UniversityGpaReport) {
  return report.cumulative.displayAverage == null
    ? "--"
    : formatAverage(report.cumulative);
}

export function gpaWaitingCourseCount(report: UniversityGpaReport) {
  return report.cumulative.excludedCourses.filter((item) =>
    /not completed|No final grade|missing or zero/i.test(item.reason)
  ).length;
}

function hasAverageCourses(result: AverageResult) {
  return result.includedCourses.length > 0;
}

export function formatCredits(value: number) {
  return Number(value.toFixed(2)).toString();
}

function formatCourseCount(value: number) {
  return `${value} ${value === 1 ? "course" : "courses"}`;
}

export function averageDetail(result: AverageResult) {
  if (!hasAverageCourses(result)) return "No final courses yet";
  return `${formatCourseCount(result.includedCourses.length)}, ${formatCredits(
    result.creditsIncluded
  )} credits`;
}

export function gpaYearRows(report: UniversityGpaReport) {
  return report.years
    .map((yearResult) => {
      const result =
        report.policy.id === "uoft"
          ? yearResult.fallWinter
          : yearResult.fullAcademicYear;
      const label =
        report.policy.id === "uoft"
          ? `Year ${yearResult.year} Fall/Winter`
          : `Year ${yearResult.year}`;
      return { id: `year-${yearResult.year}`, label, result };
    })
    .filter(({ result }) => hasAverageCourses(result));
}

export function gpaSessionRows(report: UniversityGpaReport) {
  return report.years.flatMap((yearResult) =>
    [
      { key: "fall", label: `Year ${yearResult.year} Fall`, result: yearResult.fall },
      {
        key: "winter",
        label: `Year ${yearResult.year} Winter`,
        result: yearResult.winter,
      },
      {
        key: "summer",
        label: `Year ${yearResult.year} Summer`,
        result: yearResult.summer,
      },
    ].filter(({ result }) => hasAverageCourses(result))
  );
}

export function formatGradeRange(minPercent: number, maxPercent: number) {
  const min = Math.ceil(minPercent);
  const max = maxPercent >= 99.999 ? 100 : Math.floor(maxPercent);
  return min === max ? `${min}%` : `${min}-${max}%`;
}

export function formatScaleValue(value: number) {
  return Number(value.toFixed(2)).toString();
}

function courseIsComplete(course: Course) {
  return (
    course.assignments.length > 0 && calcMetrics(course).displayCompleted >= 100
  );
}

function calcFolderMetrics(courses: Course[]) {
  const courseCount = courses.length;
  const completedCourses = courses.filter(courseIsComplete).length;
  const assignmentCount = courses.reduce(
    (sum, course) => sum + course.assignments.length,
    0
  );
  const completedAssignments = courses.reduce(
    (sum, course) =>
      sum + course.assignments.filter((a) => a.status === "completed").length,
    0
  );
  const progress =
    courseCount === 0
      ? 0
      : courses.reduce(
          (sum, course) => sum + calcMetrics(course).displayCompleted,
          0
        ) / courseCount;
  const complete = courseCount > 0 && completedCourses === courseCount;

  return {
    courseCount,
    completedCourses,
    assignmentCount,
    completedAssignments,
    progress,
    complete,
  };
}

function createDefaultSemesters(): CourseFolder[] {
  return DEFAULT_YEAR_LABELS.flatMap((year, yearIndex) =>
    DEFAULT_TERM_LABELS.map((term, termIndex) => {
      const index = yearIndex * DEFAULT_TERM_LABELS.length + termIndex;
      return {
        id: uid(),
        name: term,
        year,
        color: FOLDER_COLORS[index % FOLDER_COLORS.length],
        collapsed: false,
      };
    })
  );
}

function semesterKey(year: string | undefined, name: string) {
  return `${year ?? ""}:${name}`;
}

function isLockedUniversitySemester(folder: CourseFolder) {
  return (
    DEFAULT_YEAR_LABELS.includes(folder.year as any) &&
    DEFAULT_TERM_LABELS.includes(folder.name as any)
  );
}

function createLockedUniversitySemesters(folders: CourseFolder[] = []) {
  const existing = new Map(
    folders
      .filter(isLockedUniversitySemester)
      .map((folder) => [semesterKey(folder.year, folder.name), folder])
  );

  return DEFAULT_YEAR_LABELS.flatMap((year, yearIndex) =>
    DEFAULT_TERM_LABELS.map((term, termIndex) => {
      const index = yearIndex * DEFAULT_TERM_LABELS.length + termIndex;
      const current = existing.get(semesterKey(year, term));
      return {
        ...(current ?? {}),
        id: current?.id ?? uid(),
        name: term,
        year,
        color: current?.color ?? FOLDER_COLORS[index % FOLDER_COLORS.length],
        collapsed: current?.collapsed ?? false,
      };
    })
  );
}

function hasLockedUniversitySemesters(folders: CourseFolder[]) {
  if (folders.length !== DEFAULT_YEAR_LABELS.length * DEFAULT_TERM_LABELS.length) {
    return false;
  }
  const keys = new Set(folders.map((folder) => semesterKey(folder.year, folder.name)));
  return DEFAULT_YEAR_LABELS.every((year) =>
    DEFAULT_TERM_LABELS.every((term) => keys.has(semesterKey(year, term)))
  );
}

function clearInvalidCourseSemesters(courses: Course[], folders: CourseFolder[]) {
  const validIds = new Set(folders.map((folder) => folder.id));
  return courses.map((course) =>
    course.folderId && !validIds.has(course.folderId)
      ? { ...course, folderId: null }
      : course
  );
}

export type PassPlanResult = {
  target: number;
  selectedWeight: number;
  knownEarned: number;
  neededEach: number;
  projectedMark: number;
  possible: boolean;
  alreadySafe: boolean;
};

export function calculatePassPlan(
  course: Course,
  selectedIds: Set<string>,
  target: number
): PassPlanResult | null {
  const selected = course.assignments.filter((a) => selectedIds.has(a.id));
  const selectedWeight = selected.reduce(
    (sum, a) => sum + normalizeWeightToPercent(a.weight),
    0
  );
  if (selectedWeight <= 0) return null;

  const knownEarned = course.assignments.reduce((sum, a) => {
    if (selectedIds.has(a.id)) return sum;
    return sum + (normalizeWeightToPercent(a.weight) * (effectiveGrade(a) ?? 0)) / 100;
  }, 0);
  const neededWeightedPoints = target - knownEarned;
  const neededEach = (neededWeightedPoints / selectedWeight) * 100;
  const clampedNeeded = clamp(neededEach);
  const projectedMark = knownEarned + (selectedWeight * clampedNeeded) / 100;

  return {
    target,
    selectedWeight,
    knownEarned,
    neededEach,
    projectedMark,
    possible: neededEach <= 100,
    alreadySafe: neededEach <= 0,
  };
}

function stripLeadingZerosInput(s: string): string {
  if (s === "") return s;
  if (s[0] === "0" && s.length > 1 && s[1] !== ".") {
    const n = Number.parseFloat(s);
    if (!Number.isNaN(n)) return String(n);
  }
  return s;
}

export function parseFlexibleNumber(input: string): number | null {
  const raw = input.trim().replace(/,/g, "").replace(/%/g, "");
  if (!raw) return null;

  const fraction = raw.match(
    /^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/
  );
  if (fraction) {
    const top = Number(fraction[1]);
    const bottom = Number(fraction[2]);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) {
      return null;
    }
    return top / bottom;
  }

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseGradeInput(input: string): number | null {
  const raw = input.trim();
  const n = parseFlexibleNumber(raw);
  if (n == null) return null;
  if (raw.includes("/") || (n > 0 && n <= 1 && !raw.includes("%"))) {
    return n * 100;
  }
  return n;
}

function formatNumber(value: number | null | undefined, digits = 3) {
  if (value == null || !Number.isFinite(value)) return "";
  const rounded = Number(value.toFixed(digits));
  return String(rounded);
}

function normalizeDateInput(value: string): string | null {
  const v = value.trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const slash = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]);
    const d = new Date(year, month - 1, day);
    if (
      d.getFullYear() === year &&
      d.getMonth() === month - 1 &&
      d.getDate() === day
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}`;
    }
  }

  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(parsed.getDate()).padStart(2, "0")}`;
  }

  return null;
}

function parseStatus(value: string): AssignmentStatus {
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (v === "done" || v === "complete") return "completed";
  if (v === "progress" || v === "started") return "in_progress";
  if (v === "late") return "overdue";
  if (
    v === "completed" ||
    v === "in_progress" ||
    v === "not_started" ||
    v === "overdue"
  ) {
    return v;
  }
  return "not_started";
}

function hexToRgba(hex: string, alpha = 1) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(14, 165, 233, ${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function makeUniqueName(base: string, existing: string[]) {
  const taken = new Set(existing.map((x) => x.trim().toLowerCase()));
  const first = `${base} (copy)`;
  if (!taken.has(first.toLowerCase())) return first;
  let i = 2;
  while (taken.has(`${base} (copy ${i})`.toLowerCase())) i += 1;
  return `${base} (copy ${i})`;
}

type CompletionKind = "course" | "folder" | "all";

async function fireCompletionBurst(kind: CompletionKind = "course") {
  try {
    const { default: confetti } = await import("canvas-confetti");
    const isFolder = kind === "folder";
    const isAll = kind === "all";
    const count = isAll ? 220 : isFolder ? 170 : 120;
    confetti({
      particleCount: count,
      spread: isAll ? 110 : isFolder ? 92 : 70,
      startVelocity: isAll ? 58 : 45,
      origin: { x: 0.5, y: 0.35 },
      scalar: isAll ? 1.18 : isFolder ? 1.05 : 1,
      colors: ["#0ea5e9", "#22c55e", "#f59e0b", "#e11d48", "#8b5cf6"],
    });
    confetti({
      particleCount: isAll ? 130 : 80,
      spread: 90,
      angle: 60,
      origin: { x: 0.05, y: 0.75 },
      colors: ["#14b8a6", "#f97316", "#38bdf8"],
    });
    confetti({
      particleCount: isAll ? 130 : 80,
      spread: 90,
      angle: 120,
      origin: { x: 0.95, y: 0.75 },
      colors: ["#22c55e", "#ef4444", "#a78bfa"],
    });
    if (isFolder || isAll) {
      window.setTimeout(() => {
        confetti({
          particleCount: isAll ? 160 : 90,
          spread: 140,
          startVelocity: 36,
          origin: { x: 0.5, y: 0.1 },
          colors: ["#facc15", "#fb7185", "#38bdf8", "#4ade80"],
        });
      }, 260);
    }
  } catch {
    // Celebration is best effort; the app should keep working offline.
  }
}

function useCompletionCelebration(active: boolean, kind: CompletionKind = "course") {
  const previous = useRef(active);
  useEffect(() => {
    if (active && !previous.current) {
      void fireCompletionBurst(kind);
    }
    previous.current = active;
  }, [active, kind]);
}

/* ==========================
   Store
========================== */
interface StoreState {
  courses: Course[];
  folders: CourseFolder[];
  appMode: AppMode;
  calendarTheme: CalendarTheme;
  universityThemeId: UniversityThemeId;
  customThemeId: CustomThemeId;
  addCourse: (name: string, folderId?: string | null) => string;
  renameCourse: (id: string, name: string) => void;
  updateCourse: (id: string, patch: Partial<Course>) => void;
  setCourseColor: (id: string, color: string) => void;
  moveCourseToFolder: (id: string, folderId: string | null) => void;
  removeCourse: (id: string) => void;
  duplicateCourse: (courseId: string) => void;
  addFolder: (name: string, color?: string, year?: string) => void;
  renameFolder: (id: string, name: string) => void;
  setFolderColor: (id: string, color: string) => void;
  toggleFolderCollapsed: (id: string) => void;
  removeFolder: (id: string) => void;
  setAppMode: (mode: AppMode) => void;
  setCalendarTheme: (t: CalendarTheme) => void;
  setUniversityTheme: (t: UniversityThemeId) => void;
  setCustomTheme: (t: CustomThemeId) => void;
  addAssignment: (courseId: string, a: AssignmentDraft) => void;
  addAssignments: (courseId: string, assignments: AssignmentDraft[]) => void;
  updateAssignment: (
    courseId: string,
    aId: string,
    patch: Partial<Assignment>
  ) => void;
  removeAssignment: (courseId: string, aId: string) => void;
  duplicateAssignment: (courseId: string, aId: string) => void;
}

export const useCourseStore = create<StoreState>()(
  persist(
    (set) => ({
      courses: [],
      folders: [],
      appMode: "custom",
      calendarTheme: "system",
      universityThemeId: "uoft",
      customThemeId: "classic",
      addCourse: (name, folderId = null) => {
        const id = uid();
        set((state) => ({
          courses: [
            ...state.courses,
            {
              id,
              name,
              assignments: [],
              folderId,
              color:
                DEFAULT_COLORS[state.courses.length % DEFAULT_COLORS.length],
            },
          ],
        }));
        return id;
      },
      renameCourse: (id, name) =>
        set((state) => ({
          courses: state.courses.map((c) =>
            c.id === id ? { ...c, name } : c
          ),
        })),
      updateCourse: (id, patch) =>
        set((state) => ({
          courses: state.courses.map((c) =>
            c.id === id ? { ...c, ...patch } : c
          ),
        })),
      setCourseColor: (id, color) =>
        set((state) => ({
          courses: state.courses.map((c) =>
            c.id === id ? { ...c, color } : c
          ),
        })),
      moveCourseToFolder: (id, folderId) =>
        set((state) => ({
          courses: state.courses.map((c) =>
            c.id === id ? { ...c, folderId } : c
          ),
        })),
      removeCourse: (id) =>
        set((state) => ({
          courses: state.courses.filter((c) => c.id !== id),
        })),
      duplicateCourse: (courseId) =>
        set((state) => {
          const original = state.courses.find((c) => c.id === courseId);
          if (!original) return {};
          const cloneAssignments = original.assignments.map((a) => ({
            ...a,
            id: uid(),
          }));
          const newCourse: Course = {
            ...original,
            id: uid(),
            name: makeUniqueName(
              original.name,
              state.courses.map((c) => c.name)
            ),
            folderId: original.folderId ?? null,
            assignments: cloneAssignments,
            color: DEFAULT_COLORS[state.courses.length % DEFAULT_COLORS.length],
          };
          return { courses: [...state.courses, newCourse] };
        }),
      addFolder: (name, color, year) =>
        set((state) => {
          if (state.appMode === "university") return {};
          return {
            folders: [
              ...state.folders,
              {
                id: uid(),
                name,
                year,
                color:
                  color ?? FOLDER_COLORS[state.folders.length % FOLDER_COLORS.length],
                collapsed: false,
              },
            ],
          };
        }),
      renameFolder: (id, name) =>
        set((state) =>
          state.appMode === "university"
            ? {}
            : {
                folders: state.folders.map((f) =>
                  f.id === id ? { ...f, name } : f
                ),
              }
        ),
      setFolderColor: (id, color) =>
        set((state) =>
          state.appMode === "university"
            ? {}
            : {
                folders: state.folders.map((f) =>
                  f.id === id ? { ...f, color } : f
                ),
              }
        ),
      toggleFolderCollapsed: (id) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, collapsed: !f.collapsed } : f
          ),
        })),
      removeFolder: (id) =>
        set((state) =>
          state.appMode === "university"
            ? {}
            : {
                folders: state.folders.filter((f) => f.id !== id),
                courses: state.courses.map((c) =>
                  c.folderId === id ? { ...c, folderId: null } : c
                ),
              }
        ),
      setAppMode: (mode) =>
        set((state) => {
          if (mode !== "university") return { appMode: mode };
          const folders = createLockedUniversitySemesters(state.folders);
          return {
            appMode: mode,
            folders,
            courses: clearInvalidCourseSemesters(state.courses, folders),
            universityThemeId:
              state.universityThemeId === "markmate" ? "uoft" : state.universityThemeId,
          };
        }),
      setCalendarTheme: (t) => set({ calendarTheme: t }),
      setUniversityTheme: (t) => set({ universityThemeId: t }),
      setCustomTheme: (t) => set({ customThemeId: t }),
      addAssignment: (courseId, a) =>
        set((state) => ({
          courses: state.courses.map((c) =>
            c.id === courseId
              ? {
                  ...c,
                  assignments: [
                    ...c.assignments,
                    { id: uid(), late: false, latePenalty: 10, ...a },
                  ],
                }
              : c
          ),
        })),
      addAssignments: (courseId, assignments) =>
        set((state) => ({
          courses: state.courses.map((c) =>
            c.id === courseId
              ? {
                  ...c,
                  assignments: [
                    ...c.assignments,
                    ...assignments.map((a) => ({
                      id: uid(),
                      late: false,
                      latePenalty: 10,
                      ...a,
                    })),
                  ],
                }
              : c
          ),
        })),
      updateAssignment: (courseId, aId, patch) =>
        set((state) => ({
          courses: state.courses.map((c) =>
            c.id === courseId
              ? {
                  ...c,
                  assignments: c.assignments.map((a) =>
                    a.id === aId ? { ...a, ...patch } : a
                  ),
                }
              : c
          ),
        })),
      removeAssignment: (courseId, aId) =>
        set((state) => ({
          courses: state.courses.map((c) =>
            c.id === courseId
              ? {
                  ...c,
                  assignments: c.assignments.filter((a) => a.id !== aId),
                }
              : c
          ),
        })),
      duplicateAssignment: (courseId, aId) =>
        set((state) => ({
          courses: state.courses.map((c) => {
            if (c.id !== courseId) return c;
            const original = c.assignments.find((a) => a.id === aId);
            if (!original) return c;
            const clone: Assignment = {
              ...original,
              id: uid(),
              title: makeUniqueName(
                original.title || "Untitled",
                c.assignments.map((a) => a.title)
              ),
            };
            return { ...c, assignments: [...c.assignments, clone] };
          }),
        })),
    }),
    { name: "course-tracker-v1" }
  )
);

/* ==========================
   UI Primitives
========================== */
function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`max-h-[92vh] w-full ${width} overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button
            type="button"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

type ButtonVariant = "primary" | "ghost" | "outline" | "danger" | "subtle";

function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  className = "",
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  const base =
    "inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 dark:focus:ring-white dark:focus:ring-offset-slate-950";
  const map: Record<ButtonVariant, string> = {
    primary:
      "bg-slate-950 text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200",
    ghost:
      "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
    outline:
      "border border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800",
    danger:
      "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300",
    subtle:
      "bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
  };

  return (
    <button
      type={type}
      className={`${base} ${map[variant]} ${className}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  onClick,
  title,
  variant = "ghost",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title: string;
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      title={title}
      variant={variant}
      className="h-9 w-9 px-0"
      disabled={disabled}
    >
      <span className="sr-only">{title}</span>
      {children}
    </Button>
  );
}

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", onWheel, ...props }, ref) {
  return (
    <input
      {...props}
      ref={ref}
      onWheel={(event) => {
        if (props.type === "number") event.currentTarget.blur();
        onWheel?.(event);
      }}
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:focus:border-white dark:focus:ring-white/10 ${className}`}
    />
  );
});

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-28 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:focus:border-white dark:focus:ring-white/10 ${
        props.className ?? ""
      }`}
    />
  );
}

function SelectBox({
  value,
  onChange,
  children,
  className = "",
  title,
  onClick,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLSelectElement>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={onClick}
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:focus:border-white dark:focus:ring-white/10 ${className}`}
      title={title}
    >
      {children}
    </select>
  );
}

function Badge({
  children,
  intent = "default",
}: {
  children: React.ReactNode;
  intent?: "default" | "success" | "danger" | "info" | "warning";
}) {
  const map: Record<string, string> = {
    default:
      "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
    success:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
    danger:
      "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900",
    info: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900",
    warning:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${map[intent]}`}
    >
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm font-medium">{children}</label>;
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition ${
            value === item.value
              ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
              : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ColorField({
  value,
  onChange,
  palette = DEFAULT_COLORS,
}: {
  value: string;
  onChange: (value: string) => void;
  palette?: readonly string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {palette.map((color) => (
        <button
          key={color}
          type="button"
          className={`h-7 w-7 rounded-md border transition ${
            value.toLowerCase() === color.toLowerCase()
              ? "border-slate-950 ring-2 ring-slate-950/20 dark:border-white dark:ring-white/20"
              : "border-slate-200 dark:border-slate-700"
          }`}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
          title={color}
          aria-label={`Use color ${color}`}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 rounded-md border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
        title="Custom color"
      />
    </div>
  );
}

function SemesterSelect({
  value,
  onChange,
  className = "",
}: {
  value: string | null | undefined;
  onChange: (folderId: string | null) => void;
  className?: string;
}) {
  const folders = useCourseStore((s) => s.folders);
  return (
    <SelectBox
      value={value ?? ""}
      onChange={(next) => onChange(next === "" ? null : next)}
      className={className}
      title="Semester"
    >
      <option value="">No semester</option>
      {folders.map((folder) => (
        <option key={folder.id} value={folder.id}>
          {folder.year ? `${folder.year} / ${folder.name}` : folder.name}
        </option>
      ))}
    </SelectBox>
  );
}

/* ==========================
   Progress Ring
========================== */
function Donut({
  value,
  size = 112,
  label = "Complete",
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const v = clamp(value);
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (v / 100) * circumference;
  const color = v >= 100 ? "#22c55e" : v >= 80 ? "#0ea5e9" : v >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div
      className={`progress-ring ${v >= 100 ? "progress-ring-complete" : ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-200 dark:text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="progress-ring-path"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums">
          {v.toFixed(0)}%
        </span>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {label}
        </span>
      </div>
    </div>
  );
}

/* ==========================
   Modals
========================== */
function AddSemesterModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const addFolder = useCourseStore((s) => s.addFolder);
  const folders = useCourseStore((s) => s.folders);
  const [name, setName] = useState("");
  const [year, setYear] = useState<string>(DEFAULT_YEAR_LABELS[0]);
  const [color, setColor] = useState<string>(FOLDER_COLORS[0]);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setYear(DEFAULT_YEAR_LABELS[0]);
    setError("");
    setColor(FOLDER_COLORS[folders.length % FOLDER_COLORS.length]);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, folders.length]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Semester name is required");
      return;
    }
    addFolder(trimmed, color, year.trim() || undefined);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="New Semester" width="max-w-lg">
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div>
          <FieldLabel>Semester name</FieldLabel>
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            placeholder="Year 1 Sem 1"
          />
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </div>
        <div>
          <FieldLabel>Year</FieldLabel>
          <Input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Year 1"
          />
        </div>
        <div>
          <FieldLabel>Semester color</FieldLabel>
          <ColorField
            value={color}
            onChange={setColor}
            palette={FOLDER_COLORS}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <CalendarDays className="h-4 w-4" />
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function AddCourseModal({
  open,
  onClose,
  defaultFolderId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  defaultFolderId: string | null;
  onCreated: (courseId: string) => void;
}) {
  const addCourse = useCourseStore((s) => s.addCourse);
  const folders = useCourseStore((s) => s.folders);
  const [name, setName] = useState("");
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setError("");
    setFolderId(defaultFolderId ?? folders[0]?.id ?? null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, defaultFolderId, folders]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Course name is required");
      return;
    }
    const courseId = addCourse(trimmed, folderId);
    onClose();
    onCreated(courseId);
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Course" width="max-w-lg">
      <form noValidate className="space-y-4" onSubmit={onSubmit}>
        <div>
          <FieldLabel>Course name</FieldLabel>
          <Input
            ref={inputRef}
            type="text"
            placeholder="CIV 312"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
          />
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </div>
        <div>
          <FieldLabel>Semester</FieldLabel>
          <SemesterSelect value={folderId} onChange={setFolderId} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </form>
    </Modal>
  );
}

type BulkAssignmentDraft = {
  rowId: string;
  title: string;
  dueDate: string;
  weight: string;
  status: AssignmentStatus;
  grade: string;
};

const blankBulkRow = (): BulkAssignmentDraft => ({
  rowId: uid(),
  title: "",
  dueDate: "",
  weight: "",
  status: "not_started",
  grade: "",
});

function parseBulkLines(text: string): BulkAssignmentDraft[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const delimiter = line.includes("|")
        ? "|"
        : line.includes("\t")
        ? "\t"
        : ",";
      const [title = "", dueDate = "", weight = "", status = "", grade = ""] =
        line.split(delimiter).map((part) => part.trim());
      return {
        rowId: uid(),
        title,
        dueDate,
        weight,
        status: parseStatus(status),
        grade,
      };
    });
}

function AddAssignmentModal({
  open,
  onClose,
  courseId,
  initialMode,
}: {
  open: boolean;
  onClose: () => void;
  courseId: string;
  initialMode: AssignmentMode;
}) {
  const addAssignment = useCourseStore((s) => s.addAssignment);
  const addAssignments = useCourseStore((s) => s.addAssignments);

  const [mode, setMode] = useState<AssignmentMode>(initialMode);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [weight, setWeight] = useState("");
  const [status, setStatus] = useState<AssignmentStatus>("not_started");
  const [grade, setGrade] = useState("");
  const [singleErrors, setSingleErrors] = useState<{
    title?: string;
    weight?: string;
    grade?: string;
  }>({});
  const [bulkText, setBulkText] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkAssignmentDraft[]>([
    blankBulkRow(),
    blankBulkRow(),
    blankBulkRow(),
  ]);
  const [bulkError, setBulkError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setTitle("");
    setDueDate("");
    setWeight("");
    setStatus("not_started");
    setGrade("");
    setSingleErrors({});
    setBulkText("");
    setBulkRows([blankBulkRow(), blankBulkRow(), blankBulkRow()]);
    setBulkError("");
    if (initialMode === "single") {
      window.setTimeout(() => titleRef.current?.focus(), 0);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (open && mode === "single") {
      window.setTimeout(() => titleRef.current?.focus(), 0);
    }
  }, [open, mode]);

  const validateSingle = () => {
    const errors: typeof singleErrors = {};
    if (!title.trim()) errors.title = "Title is required";

    const parsedWeight = weight.trim() === "" ? 0 : parseFlexibleNumber(weight);
    if (parsedWeight == null) errors.weight = "Use 25, 0.25, or 1/4";
    else if (parsedWeight < 0) errors.weight = "Weight must be at least 0";
    else if (parsedWeight > 1000) errors.weight = "Weight is too large";

    if (grade.trim()) {
      const parsedGrade = parseGradeInput(grade);
      if (parsedGrade == null || parsedGrade < 0 || parsedGrade > 100) {
        errors.grade = "Use 87, 0.87, 87%, or 43/50";
      }
    }

    setSingleErrors(errors);
    return errors;
  };

  const onSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateSingle();
    if (Object.keys(errors).length) return;

    addAssignment(courseId, {
      title: title.trim(),
      dueDate: dueDate || null,
      weight: weight.trim() === "" ? 0 : parseFlexibleNumber(weight)!,
      status: grade.trim() === "" ? status : "completed",
      grade: grade.trim() === "" ? null : parseGradeInput(grade),
    });
    onClose();
  };

  const updateBulkRow = (
    rowId: string,
    patch: Partial<BulkAssignmentDraft>
  ) => {
    setBulkRows((rows) =>
      rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
    );
    if (bulkError) setBulkError("");
  };

  const onParseBulk = () => {
    const parsed = parseBulkLines(bulkText);
    if (!parsed.length) return;
    setBulkRows((rows) => [
      ...rows.filter((row) =>
        [row.title, row.dueDate, row.weight, row.grade].some((v) => v.trim())
      ),
      ...parsed,
    ]);
    setBulkText("");
    setBulkError("");
  };

  const onBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const activeRows = bulkRows.filter((row) =>
      [row.title, row.dueDate, row.weight, row.grade].some((v) => v.trim())
    );
    if (!activeRows.length) {
      setBulkError("Add at least one assignment");
      return;
    }

    const prepared: AssignmentDraft[] = [];
    for (const row of activeRows) {
      if (!row.title.trim()) {
        setBulkError("Every row needs a title");
        return;
      }

      const normalizedDate = normalizeDateInput(row.dueDate);
      if (normalizedDate == null) {
        setBulkError(`Check the date for ${row.title}`);
        return;
      }

      const parsedWeight =
        row.weight.trim() === "" ? 0 : parseFlexibleNumber(row.weight);
      if (parsedWeight == null || parsedWeight < 0 || parsedWeight > 1000) {
        setBulkError(`Check the weight for ${row.title}`);
        return;
      }

      let parsedGrade: number | null = null;
      if (row.grade.trim()) {
        parsedGrade = parseGradeInput(row.grade);
        if (parsedGrade == null || parsedGrade < 0 || parsedGrade > 100) {
          setBulkError(`Check the grade for ${row.title}`);
          return;
        }
      }

      prepared.push({
        title: row.title.trim(),
        dueDate: normalizedDate || null,
        weight: parsedWeight,
        status: parsedGrade == null ? row.status : "completed",
        grade: parsedGrade,
      });
    }

    addAssignments(courseId, prepared);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Assignments"
      width="max-w-5xl"
    >
      <div className="mb-4">
        <SegmentedControl
          value={mode}
          onChange={setMode}
          items={[
            {
              value: "single",
              label: "Single",
              icon: <CalendarPlus className="h-4 w-4" />,
            },
            {
              value: "bulk",
              label: "Bulk",
              icon: <ListPlus className="h-4 w-4" />,
            },
          ]}
        />
      </div>

      {mode === "single" ? (
        <form noValidate className="space-y-4" onSubmit={onSingleSubmit}>
          <div>
            <FieldLabel>Title</FieldLabel>
            <Input
              ref={titleRef}
              type="text"
              placeholder="Midterm"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (singleErrors.title) {
                  setSingleErrors({ ...singleErrors, title: undefined });
                }
              }}
              autoFocus
            />
            {singleErrors.title && (
              <p className="mt-1 text-xs text-rose-600">
                {singleErrors.title}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Due date</FieldLabel>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Weight</FieldLabel>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="25 or 1/4"
                value={weight}
                onChange={(e) => {
                  setWeight(stripLeadingZerosInput(e.target.value));
                  if (singleErrors.weight) {
                    setSingleErrors({ ...singleErrors, weight: undefined });
                  }
                }}
              />
              {singleErrors.weight && (
                <p className="mt-1 text-xs text-rose-600">
                  {singleErrors.weight}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Status</FieldLabel>
              <SelectBox
                value={status}
                onChange={(v) => setStatus(v as AssignmentStatus)}
              >
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectBox>
            </div>
            <div>
              <FieldLabel>Grade</FieldLabel>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="87 or 43/50"
                value={grade}
                onChange={(e) => {
                  setGrade(e.target.value);
                  if (singleErrors.grade) {
                    setSingleErrors({ ...singleErrors, grade: undefined });
                  }
                }}
              />
              {singleErrors.grade && (
                <p className="mt-1 text-xs text-rose-600">
                  {singleErrors.grade}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </form>
      ) : (
        <form noValidate className="space-y-4" onSubmit={onBulkSubmit}>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Essay | 2026-02-14 | 15 | in progress | 88"
            />
            <div className="flex items-start lg:pt-0">
              <Button
                variant="outline"
                onClick={onParseBulk}
                disabled={!bulkText.trim()}
              >
                <ClipboardList className="h-4 w-4" />
                Parse
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[1.4fr_0.9fr_0.8fr_1fr_0.8fr_44px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/70">
                <span>Title</span>
                <span>Date</span>
                <span>Weight</span>
                <span>Status</span>
                <span>Grade</span>
                <span />
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {bulkRows.map((row) => (
                  <div
                    key={row.rowId}
                    className="grid grid-cols-[1.4fr_0.9fr_0.8fr_1fr_0.8fr_44px] gap-2 px-3 py-2"
                  >
                    <Input
                      value={row.title}
                      onChange={(e) =>
                        updateBulkRow(row.rowId, { title: e.target.value })
                      }
                      placeholder="Assignment"
                    />
                    <Input
                      value={row.dueDate}
                      onChange={(e) =>
                        updateBulkRow(row.rowId, { dueDate: e.target.value })
                      }
                      placeholder="YYYY-MM-DD"
                    />
                    <Input
                      value={row.weight}
                      inputMode="decimal"
                      onChange={(e) =>
                        updateBulkRow(row.rowId, { weight: e.target.value })
                      }
                      placeholder="1/4"
                    />
                    <SelectBox
                      value={row.status}
                      onChange={(v) =>
                        updateBulkRow(row.rowId, {
                          status: v as AssignmentStatus,
                        })
                      }
                    >
                      {Object.entries(STATUS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </SelectBox>
                    <Input
                      value={row.grade}
                      inputMode="decimal"
                      onChange={(e) =>
                        updateBulkRow(row.rowId, { grade: e.target.value })
                      }
                      placeholder="43/50"
                    />
                    <IconButton
                      title="Remove row"
                      variant="ghost"
                      onClick={() =>
                        setBulkRows((rows) =>
                          rows.length === 1
                            ? [blankBulkRow()]
                            : rows.filter((r) => r.rowId !== row.rowId)
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </IconButton>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {bulkError && <p className="text-sm text-rose-600">{bulkError}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setBulkRows((rows) => [...rows, blankBulkRow()])}
            >
              <Plus className="h-4 w-4" />
              Row
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                <ListPlus className="h-4 w-4" />
                Add Bulk
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ==========================
   Top Level Navigation
========================== */
function TopBar({
  onAddCourse,
  onAddFolder,
  onHome,
  tab,
  setTab,
  isHome,
  appMode,
  setAppMode,
  universityThemeId,
  setUniversityTheme,
  customThemeId,
  setCustomTheme,
}: {
  onAddCourse: () => void;
  onAddFolder: () => void;
  onHome: () => void;
  tab: "dashboard" | "calendar";
  setTab: (t: "dashboard" | "calendar") => void;
  isHome: boolean;
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  universityThemeId: UniversityThemeId;
  setUniversityTheme: (t: UniversityThemeId) => void;
  customThemeId: CustomThemeId;
  setCustomTheme: (t: CustomThemeId) => void;
}) {
  return (
    <div className="topbar-shell sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={onHome}
          className="flex items-center gap-2 rounded-md px-1 py-1 text-left hover:opacity-80"
          aria-label="Go to dashboard"
        >
          <MarkMateLogo size="sm" />
          <span>
            <span className="block text-sm font-semibold leading-4">
              MarkMate
            </span>
            <span className="hidden text-xs text-slate-500 sm:block">
              Courses, deadlines, marks
            </span>
          </span>
        </button>

        {!isHome && (
        <div className="flex items-center gap-2">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            items={[
              {
                value: "dashboard",
                label: "Dashboard",
                icon: <LayoutDashboard className="h-4 w-4" />,
              },
              {
                value: "calendar",
                label: "Calendar",
                icon: <CalendarDays className="h-4 w-4" />,
              },
            ]}
          />
          <div className="hidden w-32 lg:block">
            <SelectBox
              value={appMode}
              onChange={(value) => setAppMode(value as AppMode)}
              className="h-10 py-1.5"
              title="Setup mode"
            >
              <option value="university">University</option>
              <option value="custom">Custom</option>
            </SelectBox>
          </div>
          <div className="hidden w-44 md:block">
            {appMode === "university" ? (
              <SelectBox
                value={universityThemeId === "markmate" ? "uoft" : universityThemeId}
                onChange={(value) =>
                  setUniversityTheme(value as UniversityThemeId)
                }
                className="h-10 py-1.5"
                title="University theme"
              >
                {REAL_UNIVERSITY_THEME_OPTIONS.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.label}
                  </option>
                ))}
              </SelectBox>
            ) : (
              <SelectBox
                value={customThemeId}
                onChange={(value) => setCustomTheme(value as CustomThemeId)}
                className="h-10 py-1.5"
                title="MarkMate theme"
              >
                {CUSTOM_THEME_OPTIONS.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.label}
                  </option>
                ))}
              </SelectBox>
            )}
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            {appMode === "custom" ? (
              <Button variant="outline" onClick={onAddFolder}>
                <CalendarDays className="h-4 w-4" />
                Semester
              </Button>
            ) : (
              <div className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                University semesters
              </div>
            )}
            <Button onClick={onAddCourse}>
              <Plus className="h-4 w-4" />
              Course
            </Button>
          </div>
          <div className="flex items-center gap-2 sm:hidden">
            {appMode === "custom" && (
              <IconButton title="New semester" variant="outline" onClick={onAddFolder}>
                <CalendarDays className="h-4 w-4" />
              </IconButton>
            )}
            <IconButton title="Add course" onClick={onAddCourse}>
              <Plus className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

function CelebrationCenter() {
  const courses = useCourseStore((s) => s.courses);
  const folders = useCourseStore((s) => s.folders);
  const [toast, setToast] = useState<{
    kind: CompletionKind;
    title: string;
    detail: string;
  } | null>(null);
  const previous = useRef({
    courses: new Set<string>(),
    folders: new Set<string>(),
    all: false,
    initialized: false,
  });

  useEffect(() => {
    const completeCourses = new Set(
      courses.filter(courseIsComplete).map((course) => course.id)
    );
    const coursesByFolder = new Map<string, Course[]>();
    for (const course of courses) {
      if (!course.folderId) continue;
      coursesByFolder.set(course.folderId, [
        ...(coursesByFolder.get(course.folderId) ?? []),
        course,
      ]);
    }
    const completeFolders = new Set(
      folders
        .filter((folder) => calcFolderMetrics(coursesByFolder.get(folder.id) ?? []).complete)
        .map((folder) => folder.id)
    );
    const allComplete =
      courses.length > 0 && courses.every((course) => courseIsComplete(course));

    if (!previous.current.initialized) {
      previous.current = {
        courses: completeCourses,
        folders: completeFolders,
        all: allComplete,
        initialized: true,
      };
      return;
    }

    const newlyCompletedFolder = folders.find(
      (folder) =>
        completeFolders.has(folder.id) &&
        !previous.current.folders.has(folder.id)
    );
    const newlyCompletedCourse = courses.find(
      (course) =>
        completeCourses.has(course.id) &&
        !previous.current.courses.has(course.id)
    );

    const shouldCelebrateAll = allComplete && !previous.current.all;

    if (newlyCompletedFolder) {
      void fireCompletionBurst("folder");
      setToast({
        kind: "folder",
        title: `${newlyCompletedFolder.name} is complete`,
        detail: "Semester cleared. That deserves a victory lap.",
      });
    } else if (newlyCompletedCourse) {
      void fireCompletionBurst("course");
      setToast({
        kind: "course",
        title: `${newlyCompletedCourse.name} is complete`,
        detail: "Course finished. Progress ring hit the good kind of loud.",
      });
    } else if (shouldCelebrateAll) {
      void fireCompletionBurst("all");
      setToast({
        kind: "all",
        title: "Everything is complete",
        detail: "Full academic sweep. That deserves a ridiculous amount of confetti.",
      });
    }

    if (shouldCelebrateAll && (newlyCompletedFolder || newlyCompletedCourse)) {
      window.setTimeout(() => {
        void fireCompletionBurst("all");
        setToast({
          kind: "all",
          title: "Everything is complete",
          detail:
            "Full academic sweep. That deserves a ridiculous amount of confetti.",
        });
      }, 1800);
    }

    previous.current = {
      courses: completeCourses,
      folders: completeFolders,
      all: allComplete,
      initialized: true,
    };
  }, [courses, folders]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  const Icon =
    toast.kind === "all"
      ? Trophy
      : toast.kind === "folder"
      ? Medal
      : PartyPopper;

  return (
    <div className={`celebration-toast celebration-${toast.kind}`}>
      <div className="celebration-toast-icon">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="font-semibold">{toast.title}</div>
        <div className="text-sm opacity-85">{toast.detail}</div>
      </div>
      <button
        type="button"
        className="ml-2 rounded-md p-1 hover:bg-white/20"
        onClick={() => setToast(null)}
        aria-label="Dismiss celebration"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ==========================
   Dashboard
========================== */
function StatTile({
  icon,
  label,
  value,
  detail,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="stat-tile rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 flex items-start justify-between gap-2 text-slate-500">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wide">
            {label}
          </span>
        </div>
        {action}
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{detail}</div>
    </div>
  );
}

function AverageBreakdownRow({
  label,
  result,
}: {
  label: string;
  result: AverageResult;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </div>
        <div className="mt-0.5 text-xs text-slate-500">
          {averageDetail(result)}
        </div>
      </div>
      <div className="shrink-0 text-sm font-semibold tabular-nums text-slate-950 dark:text-white">
        {formatAverage(result)}
      </div>
    </div>
  );
}

function GpaBreakdownPanel({
  report,
  waitingCount,
  warnings,
}: {
  report: UniversityGpaReport;
  waitingCount: number;
  warnings: string[];
}) {
  const yearRows = gpaYearRows(report);
  const sessionRows = gpaSessionRows(report);

  return (
    <details className="rounded-lg border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-500 shadow-soft backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <summary className="cursor-pointer font-medium text-slate-700 marker:text-slate-400 dark:text-slate-200">
        GPA / average details
      </summary>
      <div className="mt-3 space-y-4">
        <p>
          MarkMate estimates GPA/averages from official school rules and your
          entered data. Your registrar record is the source of truth.
        </p>
        <p>
          {report.policy.shortName} uses {report.policy.scaleLabel}. A course
          joins the estimate when its weighted assignments total 100% and every
          weighted grade is filled, or when you enter a transcript result in
          that course.
        </p>

        <div className="grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {report.policy.cumulativeAverageLabel}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
              {formatSchoolAverage(report)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {averageDetail(report.cumulative)}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                {report.policy.yearlyAverageLabel}
              </div>
              {yearRows.length > 0 ? (
                <div className="space-y-2">
                  {yearRows.map(({ id, label, result }) => (
                    <AverageBreakdownRow key={id} label={label} result={result} />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 dark:border-slate-700">
                  No completed year averages yet.
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                {report.policy.termAverageLabel}
              </div>
              {sessionRows.length > 0 ? (
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {sessionRows.map(({ key, label, result }) => (
                    <AverageBreakdownRow
                      key={`${label}-${key}`}
                      label={label}
                      result={result}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 dark:border-slate-700">
                  No completed session averages yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {waitingCount > 0 && (
          <p>
            {waitingCount} {waitingCount === 1 ? "course is" : "courses are"}{" "}
            waiting on final marks or GPA settings.
          </p>
        )}
        {warnings.length > 0 && (
          <div>
            <div className="font-medium text-slate-600 dark:text-slate-300">
              Notes from the policy engine
            </div>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {warnings.slice(0, 3).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            {warnings.length > 3 && (
              <p className="mt-1">
                {warnings.length - 3} more notes are hidden to keep this calm.
              </p>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

function GpaPolicyHelpModal({
  open,
  onClose,
  report,
}: {
  open: boolean;
  onClose: () => void;
  report: UniversityGpaReport;
}) {
  const explanation = GPA_POLICY_EXPLANATIONS[report.policy.id];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="GPA estimate"
      width="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-800">
              <CircleHelp className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-950 dark:text-white">
                {explanation.title}
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {explanation.summary}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Cumulative
            </div>
            <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
              {report.policy.cumulativeAverageLabel}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Year
            </div>
            <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
              {report.policy.yearlyAverageLabel}
            </div>
          </div>
          <div className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Session
            </div>
            <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
              {report.policy.termAverageLabel}
            </div>
          </div>
        </div>

        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          {explanation.bullets.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Grade scale used by this estimate
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {report.policy.scaleKind === "points"
                ? `Letter grades are converted to ${report.policy.scaleLabel} points before weighting by course credit.`
                : "Exact numeric grades are used whenever possible. For letter-only entries, MarkMate uses the calculated value shown here."}
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Grade</th>
                  <th className="px-3 py-2 text-left font-semibold">Percent range</th>
                  <th className="px-3 py-2 text-right font-semibold">
                    {report.policy.scaleKind === "points"
                      ? "Grade points"
                      : "Calculated value"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {report.policy.gradeBands.map((band, index) => (
                  <tr key={`${band.letter}-${index}`}>
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                      {band.letter}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                      {formatGradeRange(band.minPercent, band.maxPercent)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-800 dark:text-slate-100">
                      {formatScaleValue(band.value)}
                      {report.policy.scaleKind === "percent" ? "%" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-900/60">
          MarkMate estimates GPA/averages from official school rules and your
          entered data. Your registrar record is the source of truth.
        </p>
      </div>
    </Modal>
  );
}

function CourseCard({
  course,
  folder,
  onOpen,
}: {
  course: Course;
  folder: CourseFolder | null;
  onOpen: () => void;
}) {
  const duplicateCourse = useCourseStore((s) => s.duplicateCourse);
  const metrics = useMemo(() => calcMetrics(course), [course]);
  const next = useMemo(() => nextDue(course.assignments), [course.assignments]);
  const complete = metrics.displayCompleted >= 100 && course.assignments.length > 0;

  return (
    <article
      className={`course-card cursor-pointer rounded-lg border bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:bg-slate-950 ${
        complete
          ? "course-card-complete border-emerald-300 dark:border-emerald-800"
          : "border-slate-200 dark:border-slate-800"
      }`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      {complete && (
        <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
          <Trophy className="h-3.5 w-3.5" />
          Completed
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold tracking-tight">
              {course.name}
            </h3>
            {metrics.displayCompleted >= 100 && (
              <Sparkles className="h-4 w-4 text-emerald-500" />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {folder && (
              <Badge intent="default">
                <span
                  className="mr-1 h-2 w-2 rounded-full"
                  style={{ backgroundColor: folder.color }}
                />
                {folderDisplayName(folder)}
              </Badge>
            )}
            <Badge intent={dueTone(next?.dueDate ?? null, next?.status ?? "not_started") as any}>
              {next ? dueLabel(next.dueDate, next.status) : "No deadline"}
            </Badge>
          </div>
        </div>
        <Donut value={metrics.displayCompleted} size={82} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-xs text-slate-500">Mark</div>
          <div className="font-semibold tabular-nums">
            {metrics.currentMark.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">So far</div>
          <div className="font-semibold tabular-nums">
            {metrics.gradeSoFar == null
              ? "--"
              : `${metrics.gradeSoFar.toFixed(1)}%`}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Items</div>
          <div className="font-semibold tabular-nums">
            {course.assignments.length}
          </div>
        </div>
      </div>

      {next && (
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900/70">
          <div className="truncate font-medium">{next.title}</div>
          <div className="mt-1 text-xs text-slate-500">
            {formatDueDate(next.dueDate)}
          </div>
        </div>
      )}

      <div
        className="mt-4 flex flex-wrap items-center gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        <Button onClick={onOpen} className="flex-1">
          Open
        </Button>
        <IconButton
          title="Duplicate course"
          variant="outline"
          onClick={() => duplicateCourse(course.id)}
        >
          <Copy className="h-4 w-4" />
        </IconButton>
      </div>
    </article>
  );
}

function FolderSection({
  folder,
  courses,
  onOpenCourse,
  onAddCourse,
}: {
  folder: CourseFolder | null;
  courses: Course[];
  onOpenCourse: (id: string) => void;
  onAddCourse: (folderId: string | null) => void;
}) {
  const appMode = useCourseStore((s) => s.appMode ?? "custom");
  const renameFolder = useCourseStore((s) => s.renameFolder);
  const setFolderColor = useCourseStore((s) => s.setFolderColor);
  const removeFolder = useCourseStore((s) => s.removeFolder);
  const toggleCollapsed = useCourseStore((s) => s.toggleFolderCollapsed);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder?.name ?? "Unfiled");
  const [color, setColor] = useState(folder?.color ?? "#64748b");

  useEffect(() => {
    setName(folder?.name ?? "Unfiled");
    setColor(folder?.color ?? "#64748b");
  }, [folder?.name, folder?.color]);

  const collapsed = folder?.collapsed ?? false;
  const folderMetrics = useMemo(() => calcFolderMetrics(courses), [courses]);
  const universityLocked = appMode === "university" && !!folder;

  return (
    <section className="space-y-3">
      <div
        className={`folder-heading flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3 shadow-soft dark:bg-slate-950 ${
          folderMetrics.complete
            ? "folder-heading-complete border-emerald-300 dark:border-emerald-800"
            : "border-slate-200 dark:border-slate-800"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {folder ? (
            <IconButton
              title={collapsed ? "Expand folder" : "Collapse folder"}
              variant="ghost"
              onClick={() => toggleCollapsed(folder.id)}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </IconButton>
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800">
              <Folder className="h-4 w-4" />
            </div>
          )}
          <span
            className="h-4 w-4 rounded"
            style={{ backgroundColor: color }}
          />
          {editing && folder ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-56"
              />
              <ColorField
                value={color}
                onChange={setColor}
                palette={FOLDER_COLORS}
              />
            </div>
          ) : (
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold tracking-tight">
                {folder ? `${folder.year ? `${folder.year} / ` : ""}${folder.name}` : "Unfiled"}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>
                  {courses.length} {courses.length === 1 ? "course" : "courses"}
                </span>
                {folderMetrics.courseCount > 0 && (
                  <span>
                    {folderMetrics.completedCourses}/{folderMetrics.courseCount} done
                  </span>
                )}
                {folderMetrics.complete && (
                  <Badge intent="success">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Folder complete
                  </Badge>
                )}
                {universityLocked && <Badge intent="info">University term</Badge>}
              </div>
              <div className="mt-2 h-2 max-w-sm overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${clamp(folderMetrics.progress)}%`,
                    background: `linear-gradient(90deg, ${color}, #22c55e)`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editing && folder ? (
            <>
              <IconButton
                title="Save folder"
                onClick={() => {
                  if (name.trim()) {
                    renameFolder(folder.id, name.trim());
                    setFolderColor(folder.id, color);
                    setEditing(false);
                  }
                }}
              >
                <Save className="h-4 w-4" />
              </IconButton>
              <IconButton
                title="Cancel"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setName(folder.name);
                  setColor(folder.color);
                }}
              >
                <X className="h-4 w-4" />
              </IconButton>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onAddCourse(folder?.id ?? null)}
              >
                <Plus className="h-4 w-4" />
                Course
              </Button>
              {folder && !universityLocked && (
                <>
                  <IconButton
                    title="Edit folder"
                    variant="ghost"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    title="Delete folder"
                    variant="danger"
                    onClick={() => {
                      if (
                        confirm(
                          "Delete this folder? Courses inside it will become unfiled."
                        )
                      ) {
                        removeFolder(folder.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </>
              )}
              {universityLocked && (
                <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                  University semester
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950">
              Empty folder
            </div>
          ) : (
            courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                folder={folder}
                onOpen={() => onOpenCourse(course.id)}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

function Dashboard({
  onOpenCourse,
  onAddCourse,
  onAddFolder,
  focusFolderId,
}: {
  onOpenCourse: (id: string) => void;
  onAddCourse: (folderId: string | null) => void;
  onAddFolder: () => void;
  focusFolderId: string | null;
}) {
  const courses = useCourseStore((s) => s.courses);
  const folders = useCourseStore((s) => s.folders);
  const appMode = useCourseStore((s) => s.appMode ?? "custom");
  const universityThemeId = useCourseStore((s) => s.universityThemeId ?? "uoft");
  const renameFolder = useCourseStore((s) => s.renameFolder);
  const setFolderColor = useCourseStore((s) => s.setFolderColor);
  const removeFolder = useCourseStore((s) => s.removeFolder);
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState<string>(DEFAULT_YEAR_LABELS[0]);
  const [semesterFilter, setSemesterFilter] = useState<FolderFilter>("all");
  const [editingSemester, setEditingSemester] = useState(false);
  const [semesterName, setSemesterName] = useState("");
  const [semesterYear, setSemesterYear] = useState<string>(DEFAULT_YEAR_LABELS[0]);
  const [semesterColor, setSemesterColor] = useState<string>(FOLDER_COLORS[0]);
  const [gpaHelpOpen, setGpaHelpOpen] = useState(false);

  const foldersById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders]
  );
  const gpaUniversityId = selectedUniversityId(universityThemeId);
  const gpaRecords = useMemo(
    () => buildCourseGradeRecords(courses, foldersById, gpaUniversityId),
    [courses, foldersById, gpaUniversityId]
  );
  const gpaReport = useMemo(
    () => calculateUniversityReport(gpaRecords, gpaUniversityId),
    [gpaRecords, gpaUniversityId]
  );
  const gpaWaitingCount = gpaWaitingCourseCount(gpaReport);
  const gpaWarnings = gpaReport.cumulative.warnings;
  const gpaIncludedCount = gpaReport.cumulative.includedCourses.length;
  const gpaCreditsText = Number(
    gpaReport.cumulative.creditsIncluded.toFixed(2)
  ).toString();
  const yearOptions = useMemo(() => {
    const years = new Set<string>(
      appMode === "university" ? DEFAULT_YEAR_LABELS : []
    );
    for (const folder of folders) {
      if (folder.year) years.add(folder.year);
      else years.add("Custom");
    }
    return Array.from(years);
  }, [appMode, folders]);
  const visibleSemesters = useMemo(
    () =>
      yearFilter === "all"
        ? folders
        : folders.filter((folder) => (folder.year ?? "Custom") === yearFilter),
    [folders, yearFilter]
  );
  const universitySemestersByYear = useMemo(
    () =>
      DEFAULT_YEAR_LABELS.map((year) => ({
        year,
        semesters: DEFAULT_TERM_LABELS.map(
          (term) =>
            folders.find(
              (folder) => folder.year === year && folder.name === term
            ) ?? null
        ),
      })),
    [folders]
  );
  const selectedSemester =
    semesterFilter !== "all" && semesterFilter !== "unfiled"
      ? foldersById.get(semesterFilter) ?? null
      : null;
  const defaultCourseSemesterId =
    selectedSemester?.id ?? visibleSemesters[0]?.id ?? null;

  useEffect(() => {
    if (semesterFilter !== "all" && semesterFilter !== "unfiled" && !selectedSemester) {
      setSemesterFilter("all");
    }
  }, [selectedSemester, semesterFilter]);

  useEffect(() => {
    if (!focusFolderId) return;
    const folder = foldersById.get(focusFolderId);
    if (!folder) return;
    setYearFilter(folder.year ?? "Custom");
    setSemesterFilter(folder.id);
  }, [focusFolderId, foldersById]);

  useEffect(() => {
    if (!selectedSemester) return;
    setSemesterName(selectedSemester.name);
    setSemesterYear(selectedSemester.year ?? DEFAULT_YEAR_LABELS[0]);
    setSemesterColor(selectedSemester.color);
    setEditingSemester(false);
  }, [selectedSemester]);

  const filteredCourses = useMemo(() => {
    return courses
      .filter((course) => {
      const folder = course.folderId
        ? foldersById.get(course.folderId) ?? null
        : null;
      const matchesQuery = smartSearchMatch(
        [
          course.name,
          folderDisplayName(folder),
          folder?.name,
          folder?.year,
          ...course.assignments.map((a) => a.title),
        ],
        query
      );
      const matchesSemester =
        semesterFilter === "unfiled"
          ? !course.folderId
          : semesterFilter !== "all"
          ? course.folderId === semesterFilter
          : yearFilter === "all"
          ? true
          : folder?.year === yearFilter;
      return matchesQuery && matchesSemester;
    })
    .sort((a, b) => {
      const folderDelta =
        courseChronology(a, foldersById) - courseChronology(b, foldersById);
      if (folderDelta !== 0) return folderDelta;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }, [courses, foldersById, semesterFilter, yearFilter, query]);

  const allAssignments = courses.flatMap((course) =>
    course.assignments.map((assignment) => ({ course, assignment }))
  );
  const dueSoon = allAssignments.filter(({ assignment }) => {
    const days = daysUntil(assignment.dueDate);
    return (
      assignment.status !== "completed" &&
      days != null &&
      days >= 0 &&
      days <= 7
    );
  }).length;
  const completedCourses = courses.filter(
    (course) =>
      course.assignments.length > 0 && calcMetrics(course).displayCompleted >= 100
  ).length;
  const averageMark =
    courses.length > 0
      ? courses.reduce((sum, c) => sum + calcMetrics(c).currentMark, 0) /
        courses.length
      : 0;

  const hasAnyCourses = courses.length > 0;

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-5">
      <section className="dashboard-hero rounded-lg border border-slate-200 p-5 shadow-soft dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700 shadow-sm dark:bg-slate-950/50 dark:text-slate-200">
              <Rocket className="h-3.5 w-3.5 text-sky-500" />
              Semester board
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Keep the semester moving.
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Pick a semester, open a course, and keep the rest quiet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {appMode === "custom" ? (
              <Button variant="outline" onClick={onAddFolder}>
                <CalendarDays className="h-4 w-4" />
                Semester
              </Button>
            ) : (
              <div className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white/75 px-3 py-2 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                University structure
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          icon={<BookOpen className="h-4 w-4" />}
          label="Courses"
          value={String(courses.length)}
          detail={`${folders.length} semesters`}
        />
        <StatTile
          icon={<CalendarDays className="h-4 w-4" />}
          label="Next 7 days"
          value={String(dueSoon)}
          detail="Open assignments due soon"
        />
        <StatTile
          icon={<Gauge className="h-4 w-4" />}
          label={
            appMode === "university"
              ? "GPA estimate"
              : "Average mark"
          }
          value={
            appMode === "university"
              ? formatSchoolAverage(gpaReport)
              : hasAnyCourses
              ? `${averageMark.toFixed(1)}%`
              : "--"
          }
          detail={
            appMode === "university"
              ? gpaIncludedCount > 0
                ? `${gpaCreditsText} credits included`
                : "Add final course grades"
              : `${completedCourses} complete courses`
          }
          action={
            appMode === "university" ? (
              <button
                type="button"
                onClick={() => setGpaHelpOpen(true)}
                className="grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                aria-label="How this GPA estimate is calculated"
                title="How this GPA estimate is calculated"
              >
                <CircleHelp className="h-4 w-4" />
              </button>
            ) : undefined
          }
        />
      </div>

      {appMode === "university" && (
        <GpaBreakdownPanel
          report={gpaReport}
          waitingCount={gpaWaitingCount}
          warnings={gpaWarnings}
        />
      )}

      {appMode === "university" && (
        <GpaPolicyHelpModal
          open={gpaHelpOpen}
          onClose={() => setGpaHelpOpen(false)}
          report={gpaReport}
        />
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
        {appMode === "university" ? (
          <div className="university-semester-locker mb-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600 shadow-sm">
                  University structure
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Pick a year and semester, then add courses inside it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setYearFilter("all");
                  setSemesterFilter("all");
                }}
                className={`semester-tab ${
                  semesterFilter === "all" ? "semester-tab-active" : ""
                }`}
              >
                All semesters
              </button>
            </div>
            <div className="grid gap-3 lg:grid-cols-4">
              {universitySemestersByYear.map(({ year, semesters }) => (
                <div key={year} className="university-year-column">
                  <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                    {year}
                  </div>
                  <div className="grid gap-2">
                    {semesters.map((semester, index) => {
                      const term = DEFAULT_TERM_LABELS[index];
                      const active = semesterFilter === semester?.id;
                      return (
                        <button
                          key={`${year}-${term}`}
                          type="button"
                          disabled={!semester}
                          onClick={() => {
                            if (!semester) return;
                            setYearFilter(year);
                            setSemesterFilter(semester.id);
                          }}
                          className={`locked-semester-button ${
                            active ? "locked-semester-button-active" : ""
                          }`}
                          style={
                            {
                              "--semester-color":
                                semester?.color ??
                                FOLDER_COLORS[index % FOLDER_COLORS.length],
                            } as React.CSSProperties
                          }
                        >
                          <span className="h-2.5 w-2.5 rounded-full bg-[var(--semester-color)]" />
                          <span>{term}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-4 grid gap-3 md:grid-cols-[180px_1fr] md:items-center">
            <SelectBox
              value={yearFilter}
              onChange={(value) => {
                setYearFilter(value);
                setSemesterFilter("all");
              }}
              title="Year"
            >
              <option value="all">All years</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </SelectBox>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSemesterFilter("all")}
                className={`semester-tab ${
                  semesterFilter === "all" ? "semester-tab-active" : ""
                }`}
              >
                All
              </button>
              {visibleSemesters.map((semester) => (
                <button
                  key={semester.id}
                  type="button"
                  onClick={() => setSemesterFilter(semester.id)}
                  className={`semester-tab ${
                    semesterFilter === semester.id ? "semester-tab-active" : ""
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: semester.color }}
                  />
                  {semester.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSemesterFilter("unfiled")}
                className={`semester-tab ${
                  semesterFilter === "unfiled" ? "semester-tab-active" : ""
                }`}
              >
                No semester
              </button>
            </div>
          </div>
        )}

        {selectedSemester && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
            {appMode === "university" ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: selectedSemester.color }}
                  />
                  <span className="font-semibold">
                    {selectedSemester.year} / {selectedSemester.name}
                  </span>
                  <Badge intent="info">University term</Badge>
                  <Badge>
                    {filteredCourses.length}{" "}
                    {filteredCourses.length === 1 ? "course" : "courses"}
                  </Badge>
                </div>
                <Button onClick={() => onAddCourse(selectedSemester.id)}>
                  <Plus className="h-4 w-4" />
                  Add course here
                </Button>
              </div>
            ) : editingSemester ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={semesterName}
                  onChange={(e) => setSemesterName(e.target.value)}
                  className="max-w-xs"
                />
                <Input
                  value={semesterYear}
                  onChange={(e) => setSemesterYear(e.target.value)}
                  className="max-w-[140px]"
                  placeholder="Year 1"
                />
                <ColorField value={semesterColor} onChange={setSemesterColor} />
                <IconButton
                  title="Save semester"
                  onClick={() => {
                    if (!semesterName.trim()) return;
                    renameFolder(selectedSemester.id, semesterName.trim());
                    useCourseStore.setState((state) => ({
                      folders: state.folders.map((folder) =>
                        folder.id === selectedSemester.id
                          ? { ...folder, year: semesterYear.trim() || undefined }
                          : folder
                      ),
                    }));
                    setFolderColor(selectedSemester.id, semesterColor);
                    setEditingSemester(false);
                  }}
                >
                  <Save className="h-4 w-4" />
                </IconButton>
                <IconButton
                  title="Cancel"
                  variant="ghost"
                  onClick={() => {
                    setSemesterName(selectedSemester.name);
                    setSemesterYear(selectedSemester.year ?? DEFAULT_YEAR_LABELS[0]);
                    setSemesterColor(selectedSemester.color);
                    setEditingSemester(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: selectedSemester.color }}
                  />
                  <span className="font-semibold">{selectedSemester.name}</span>
                  <span className="text-sm text-slate-500">
                    {selectedSemester.year ?? "Custom"}
                  </span>
                  <Badge>
                    {filteredCourses.length}{" "}
                    {filteredCourses.length === 1 ? "course" : "courses"}
                  </Badge>
                </div>
                <Button variant="ghost" onClick={() => setEditingSemester(true)}>
                  <Pencil className="h-4 w-4" />
                  Rename
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (
                      confirm(
                        "Remove this semester? Courses inside it will move to No semester."
                      )
                    ) {
                      removeFolder(selectedSemester.id);
                      setSemesterFilter("all");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses or assignments"
              className="pl-9"
            />
          </div>
          {appMode === "custom" ? (
            <Button variant="outline" onClick={onAddFolder}>
              <CalendarDays className="h-4 w-4" />
              Semester
            </Button>
          ) : (
            <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 md:inline-flex">
              University semesters
            </div>
          )}
          <Button onClick={() => onAddCourse(defaultCourseSemesterId)}>
            <Plus className="h-4 w-4" />
            Course
          </Button>
        </div>
      </div>

      {!hasAnyCourses ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-950">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">
            <BookOpen className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Add your first course</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Start with a course, then place it in the semester it belongs to.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            {appMode === "custom" && (
              <Button variant="outline" onClick={onAddFolder}>
                <CalendarDays className="h-4 w-4" />
                Semester
              </Button>
            )}
            <Button onClick={() => onAddCourse(defaultCourseSemesterId)}>
              <Plus className="h-4 w-4" />
              Course
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {filteredCourses.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950">
              No matching courses
            </div>
          )}
          {filteredCourses.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  folder={
                    course.folderId ? foldersById.get(course.folderId) ?? null : null
                  }
                  onOpen={() => onOpenCourse(course.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

/* ==========================
   Course Detail
========================== */
function EditableCourseTitle({ course }: { course: Course }) {
  const renameCourse = useCourseStore((s) => s.renameCourse);
  const setCourseColor = useCourseStore((s) => s.setCourseColor);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(course.name);
  const [color, setColor] = useState(course.color ?? DEFAULT_COLORS[0]);

  useEffect(() => {
    setName(course.name);
    setColor(course.color ?? DEFAULT_COLORS[0]);
  }, [course.name, course.color]);

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="h-5 w-5 rounded"
          style={{ backgroundColor: course.color ?? DEFAULT_COLORS[0] }}
        />
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          {course.name}
        </h1>
        <IconButton
          title="Edit course"
          variant="ghost"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-4 w-4" />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-64"
      />
      <ColorField value={color} onChange={setColor} />
      <IconButton
        title="Save course"
        onClick={() => {
          if (name.trim()) {
            renameCourse(course.id, name.trim());
            setCourseColor(course.id, color);
            setEditing(false);
          }
        }}
      >
        <Save className="h-4 w-4" />
      </IconButton>
      <IconButton
        title="Cancel"
        variant="ghost"
        onClick={() => {
          setEditing(false);
          setName(course.name);
          setColor(course.color ?? DEFAULT_COLORS[0]);
        }}
      >
        <X className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

const GPA_GRADE_MODES: { value: GradeMode; label: string }[] = [
  { value: "graded", label: "Graded" },
  { value: "credit-no-credit", label: "Credit / no credit" },
  { value: "pass-fail", label: "Pass / fail" },
  { value: "satisfactory-unsatisfactory", label: "S / U" },
  { value: "audit", label: "Audit" },
  { value: "transfer", label: "Transfer" },
  { value: "extra", label: "Extra" },
  { value: "deferred", label: "Deferred" },
  { value: "incomplete", label: "Incomplete" },
];

function CourseGpaSettings({ course }: { course: Course }) {
  const appMode = useCourseStore((s) => s.appMode ?? "custom");
  const universityThemeId = useCourseStore((s) => s.universityThemeId ?? "uoft");
  const updateCourse = useCourseStore((s) => s.updateCourse);
  const universityId = selectedUniversityId(universityThemeId);
  const policy = getUniversityPolicy(universityId);
  const finalPercent = deriveCourseFinalPercent(course);
  const transcriptResult = course.transcriptResult?.trim() ?? "";
  const [creditDraft, setCreditDraft] = useState(
    formatNumber(course.creditWeight ?? null)
  );
  const [attemptDraft, setAttemptDraft] = useState(
    course.attempt == null ? "" : String(course.attempt)
  );
  const [repeatDraft, setRepeatDraft] = useState(course.repeatGroupId ?? "");
  const [resultDraft, setResultDraft] = useState(transcriptResult);

  useEffect(() => {
    setCreditDraft(formatNumber(course.creditWeight ?? null));
    setAttemptDraft(course.attempt == null ? "" : String(course.attempt));
    setRepeatDraft(course.repeatGroupId ?? "");
    setResultDraft(course.transcriptResult?.trim() ?? "");
  }, [
    course.creditWeight,
    course.attempt,
    course.repeatGroupId,
    course.transcriptResult,
  ]);

  if (appMode !== "university") return null;

  const commitCredit = () => {
    if (!creditDraft.trim()) {
      updateCourse(course.id, { creditWeight: null });
      return;
    }
    const parsed = parseFlexibleNumber(creditDraft);
    if (parsed == null || parsed <= 0) {
      setCreditDraft(formatNumber(course.creditWeight ?? null));
      return;
    }
    updateCourse(course.id, { creditWeight: parsed });
    setCreditDraft(formatNumber(parsed));
  };

  const commitAttempt = () => {
    if (!attemptDraft.trim()) {
      updateCourse(course.id, { attempt: null });
      return;
    }
    const parsed = Number(attemptDraft);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setAttemptDraft(course.attempt == null ? "" : String(course.attempt));
      return;
    }
    updateCourse(course.id, { attempt: parsed });
    setAttemptDraft(String(parsed));
  };

  const commitRepeat = () => {
    updateCourse(course.id, { repeatGroupId: repeatDraft.trim() || undefined });
  };

  const commitTranscriptResult = () => {
    updateCourse(course.id, {
      transcriptResult: resultDraft.trim().toUpperCase() || undefined,
    });
  };

  const finalLabel = transcriptResult
    ? `Using ${transcriptResult}`
    : finalPercent == null
    ? "Waiting for final data"
    : `${finalPercent.toFixed(1)}% final estimate`;

  return (
    <details className="course-detail-dim rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 marker:text-slate-400">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Gauge className="h-4 w-4 text-slate-500" />
            GPA / school average settings
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {policy.shortName} estimate: {finalLabel}
          </p>
        </div>
        <Badge intent={finalPercent != null || transcriptResult ? "info" : "default"}>
          {policy.scaleLabel}
        </Badge>
      </summary>

      <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="mb-4 max-w-3xl text-sm text-slate-500">
          Optional transcript details. Blank or in-progress courses stay out of the
          estimate until MarkMate has a full final mark or transcript result.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <FieldLabel>Credit weight</FieldLabel>
            <Input
              type="text"
              inputMode="decimal"
              placeholder={`Default ${policy.defaultCreditWeight}`}
              value={creditDraft}
              onChange={(e) => setCreditDraft(e.target.value)}
              onBlur={commitCredit}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setCreditDraft(formatNumber(course.creditWeight ?? null));
                  e.currentTarget.blur();
                }
              }}
            />
          </div>
          <div>
            <FieldLabel>Grade type</FieldLabel>
            <SelectBox
              value={course.gradeMode ?? "graded"}
              onChange={(value) =>
                updateCourse(course.id, { gradeMode: value as GradeMode })
              }
            >
              {GPA_GRADE_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </SelectBox>
          </div>
          <div>
            <FieldLabel>Transcript result</FieldLabel>
            <Input
              type="text"
              placeholder="Optional: CR, WF, J, S"
              value={resultDraft}
              onChange={(e) => setResultDraft(e.target.value)}
              onBlur={commitTranscriptResult}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setResultDraft(course.transcriptResult?.trim() ?? "");
                  e.currentTarget.blur();
                }
              }}
            />
          </div>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/60">
            <input
              type="checkbox"
              checked={course.includeInGpa !== false}
              onChange={(e) =>
                updateCourse(course.id, { includeInGpa: e.target.checked })
              }
              className="h-4 w-4"
            />
            Include in GPA/average
          </label>
          <div>
            <FieldLabel>Repeat group</FieldLabel>
            <Input
              type="text"
              placeholder="Optional"
              value={repeatDraft}
              onChange={(e) => setRepeatDraft(e.target.value)}
              onBlur={commitRepeat}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setRepeatDraft(course.repeatGroupId ?? "");
                  e.currentTarget.blur();
                }
              }}
            />
          </div>
          <div>
            <FieldLabel>Attempt</FieldLabel>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Optional"
              value={attemptDraft}
              onChange={(e) => setAttemptDraft(e.target.value)}
              onBlur={commitAttempt}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setAttemptDraft(
                    course.attempt == null ? "" : String(course.attempt)
                  );
                  e.currentTarget.blur();
                }
              }}
            />
          </div>
          <div>
            <FieldLabel>Completed date</FieldLabel>
            <Input
              type="date"
              value={course.completedAt ?? ""}
              onChange={(e) =>
                updateCourse(course.id, {
                  completedAt: e.target.value || undefined,
                })
              }
            />
          </div>
        </div>
      </div>
    </details>
  );
}

function FlexibleNumberInput({
  value,
  onCommit,
  kind,
  placeholder,
}: {
  value: number | null;
  onCommit: (value: number | null) => void;
  kind: "weight" | "grade";
  placeholder: string;
}) {
  const [draft, setDraft] = useState(formatNumber(value));
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(formatNumber(value));
    setError("");
  }, [value]);

  const commit = () => {
    if (!draft.trim()) {
      onCommit(kind === "weight" ? 0 : null);
      setError("");
      return;
    }
    const parsed =
      kind === "grade" ? parseGradeInput(draft) : parseFlexibleNumber(draft);
    if (parsed == null || parsed < 0 || (kind === "grade" && parsed > 100)) {
      setError(kind === "grade" ? "Check grade" : "Check weight");
      return;
    }
    onCommit(parsed);
    setDraft(formatNumber(parsed));
    setError("");
  };

  return (
    <div>
      <Input
        type="text"
        inputMode="decimal"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError("");
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(formatNumber(value));
            setError("");
            e.currentTarget.blur();
          }
        }}
        className={error ? "border-rose-500 focus:border-rose-500" : ""}
      />
      {error && <div className="mt-1 text-xs text-rose-600">{error}</div>}
    </div>
  );
}

function AssignmentRow({
  a,
  onChange,
  onRemove,
  onDuplicate,
  passSelectMode = false,
  passSelected = false,
  onPassToggle,
}: {
  a: Assignment;
  onChange: (patch: Partial<Assignment>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  passSelectMode?: boolean;
  passSelected?: boolean;
  onPassToggle?: () => void;
}) {
  const overdueDerived = a.status !== "completed" && isPast(a.dueDate);

  useEffect(() => {
    if (overdueDerived && a.status !== "overdue") {
      onChange({ status: "overdue" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.dueDate, a.status, overdueDerived]);

  return (
    <div
      className={`assignment-row rounded-lg border p-3 transition ${
        a.status === "completed"
          ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      } ${passSelectMode ? "pass-select-row cursor-pointer" : ""} ${
        passSelected ? "pass-select-row-active" : ""
      }`}
      onClick={passSelectMode ? onPassToggle : undefined}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {passSelectMode && (
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border text-xs ${
                  passSelected
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-300 bg-white text-transparent dark:border-slate-700 dark:bg-slate-950"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="truncate font-medium">{a.title || "Untitled"}</span>
            <Badge
              intent={
                a.status === "completed"
                  ? "success"
                  : a.status === "overdue"
                  ? "danger"
                  : a.status === "in_progress"
                  ? "info"
                  : "default"
              }
            >
              {STATUS_LABEL[a.status]}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>{formatDueDate(a.dueDate)}</span>
            <span>Weight {normalizeWeightToPercent(a.weight).toFixed(2)}%</span>
            <span>
              Grade{" "}
              {a.grade == null
                ? "--"
                : `${effectiveGrade(a)!.toFixed(2)}%${
                    a.late ? ` after -${a.latePenalty ?? 10}% late penalty` : ""
                  }`}
            </span>
          </div>
        </div>
        {!passSelectMode && (
        <div className="flex items-center gap-2">
          <IconButton title="Duplicate assignment" variant="ghost" onClick={onDuplicate}>
            <Copy className="h-4 w-4" />
          </IconButton>
          <IconButton title="Remove assignment" variant="danger" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
        )}
      </div>

      {!passSelectMode && (
      <div className="grid gap-2 lg:grid-cols-[1.35fr_0.9fr_0.75fr_1fr_0.75fr]">
        <Input
          value={a.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Title"
        />
        <Input
          type="date"
          value={a.dueDate ?? ""}
          onChange={(e) => onChange({ dueDate: e.target.value || null })}
        />
        <FlexibleNumberInput
          value={a.weight}
          kind="weight"
          placeholder="1/4"
          onCommit={(value) => onChange({ weight: value ?? 0 })}
        />
        <SelectBox
          value={a.status}
          onChange={(v) => onChange({ status: v as AssignmentStatus })}
        >
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectBox>
        <FlexibleNumberInput
          value={a.grade}
          kind="grade"
          placeholder="43/50"
          onCommit={(value) =>
            onChange({
              grade: value,
              status: value == null ? a.status : "completed",
            })
          }
        />
      </div>
      )}

      {!passSelectMode && (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant={a.status === "completed" ? "subtle" : "outline"}
          onClick={() => onChange({ status: "completed" })}
        >
          <CheckCircle2 className="h-4 w-4" />
          Mark Complete
        </Button>
        <Button
          variant={a.late ? "danger" : "outline"}
          className={a.late ? "late-penalty-button" : ""}
          onClick={() =>
            onChange({
              late: !a.late,
              latePenalty: a.latePenalty ?? 10,
            })
          }
        >
          <AlertTriangle className="h-4 w-4" />
          {a.late ? `Late -${a.latePenalty ?? 10}%` : "Late penalty"}
        </Button>
        {a.late && (
          <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 dark:border-orange-900 dark:bg-orange-950/30">
            <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
              Deduct
            </span>
            <Input
              value={String(a.latePenalty ?? 10)}
              onChange={(e) => {
                const parsed = parseFlexibleNumber(e.target.value);
                onChange({
                  latePenalty: parsed == null ? 10 : clamp(parsed),
                });
              }}
              className="h-8 w-20 py-1"
              inputMode="decimal"
            />
            <span className="text-xs text-orange-700 dark:text-orange-300">
              %
            </span>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function CourseDetail({
  course,
  onBack,
}: {
  course: Course;
  onBack: () => void;
}) {
  const update = useCourseStore((s) => s.updateAssignment);
  const remove = useCourseStore((s) => s.removeAssignment);
  const duplicateAssignment = useCourseStore((s) => s.duplicateAssignment);
  const duplicateCourse = useCourseStore((s) => s.duplicateCourse);
  const removeCourse = useCourseStore((s) => s.removeCourse);
  const moveCourseToFolder = useCourseStore((s) => s.moveCourseToFolder);
  const [addOpen, setAddOpen] = useState(false);
  const [assignmentMode, setAssignmentMode] =
    useState<AssignmentMode>("single");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AssignmentStatus>(
    "all"
  );
  const [sortMode, setSortMode] = useState("due");
  const [passMode, setPassMode] = useState(false);
  const [passSelectedIds, setPassSelectedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [passTarget, setPassTarget] = useState("50");
  const [passResult, setPassResult] = useState<PassPlanResult | null>(null);

  const metrics = useMemo(() => calcMetrics(course), [course]);
  const passReady = Math.abs(metrics.totalWeights - 100) <= 0.01;
  const passTargetNumber = parseGradeInput(passTarget) ?? 50;
  const selectedPassAssignments = useMemo(
    () => course.assignments.filter((a) => passSelectedIds.has(a.id)),
    [course.assignments, passSelectedIds]
  );

  const startPassMode = () => {
    const defaultSelected = course.assignments
      .filter((a) => a.grade == null || a.status !== "completed")
      .map((a) => a.id);
    setPassSelectedIds(new Set(defaultSelected));
    setPassTarget("50");
    setPassResult(null);
    setPassMode(true);
  };

  const finishPassMode = () => {
    const result = calculatePassPlan(
      course,
      passSelectedIds,
      clamp(passTargetNumber)
    );
    setPassResult(result);
  };

  useEffect(() => {
    if (!passMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finishPassMode();
      }
      if (event.key === "Escape") {
        setPassMode(false);
        setPassResult(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [passMode, passSelectedIds, passTargetNumber, course]);

  const visibleAssignments = useMemo(() => {
    return course.assignments
      .filter((a) => {
        const matchesQuery = smartSearchMatch([a.title, course.name], query);
        const matchesStatus = statusFilter === "all" || a.status === statusFilter;
        return matchesQuery && matchesStatus;
      })
      .slice()
      .sort((a, b) => {
        if (sortMode === "status") return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (sortMode === "weight") return normalizeWeightToPercent(b.weight) - normalizeWeightToPercent(a.weight);
        return compareDue(a, b);
      });
  }, [course.assignments, query, sortMode, statusFilter]);

  const openAdd = (mode: AssignmentMode) => {
    setAssignmentMode(mode);
    setAddOpen(true);
  };

  return (
    <main
      className={`mx-auto max-w-7xl space-y-5 px-4 py-5 ${
        passMode ? "pass-mode-active" : ""
      }`}
    >
      <div className="course-detail-dim flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <EditableCourseTitle course={course} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <SemesterSelect
              value={course.folderId ?? null}
              onChange={(folderId) => moveCourseToFolder(course.id, folderId)}
            />
          </div>
          <Button variant="outline" onClick={() => openAdd("single")}>
            <Plus className="h-4 w-4" />
            Assignment
          </Button>
          <Button variant="outline" onClick={() => openAdd("bulk")}>
            <ListPlus className="h-4 w-4" />
            Bulk
          </Button>
          <IconButton
            title="Duplicate course"
            variant="outline"
            onClick={() => duplicateCourse(course.id)}
          >
            <Copy className="h-4 w-4" />
          </IconButton>
          <IconButton
            title="Delete course"
            variant="danger"
            onClick={() => {
              if (confirm("Delete this course?")) {
                removeCourse(course.id);
                onBack();
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <section className="course-detail-dim rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-sky-500" />
              Pass helper
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Pass means 50% overall by default. You can change it after you open the helper.
            </p>
          </div>
          {passReady ? (
            <Button className="pass-helper-button" onClick={startPassMode}>
              <Sparkles className="h-4 w-4" />
              What do I need to pass?
            </Button>
          ) : (
            <Badge intent="warning">
              Add weights until this course totals 100%
            </Badge>
          )}
        </div>
      </section>

      {passMode && (
        <section className="pass-helper-panel rounded-lg border border-sky-200 bg-white p-4 shadow-soft dark:border-sky-900 dark:bg-slate-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-lg font-bold">
                <Sparkles className="h-5 w-5 text-sky-500" />
                Pick what you are still waiting on
              </div>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                I will give you the minimum grade from each selected assignment
                or test that you need to pass this course.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-28">
                <FieldLabel>Pass mark</FieldLabel>
                <Input
                  value={passTarget}
                  onChange={(e) => {
                    setPassTarget(e.target.value);
                    setPassResult(null);
                  }}
                  inputMode="decimal"
                />
              </div>
              <Button onClick={finishPassMode} className="pass-done-button">
                <Check className="h-4 w-4" />
                Done
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setPassMode(false);
                  setPassResult(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Badge intent={selectedPassAssignments.length ? "info" : "warning"}>
              {selectedPassAssignments.length} selected
            </Badge>
            <span className="text-slate-500">
              Press Enter or use Done when the selected items look right.
            </span>
          </div>
          {passResult && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              {passResult.alreadySafe ? (
                <div>
                  <div className="text-xl font-bold text-emerald-600">
                    Congrats, you are good even with 0% on the selected work.
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Even with 0% on the selected items, your current known mark reaches {passResult.target.toFixed(1)}%.
                  </p>
                </div>
              ) : passResult.possible ? (
                <div>
                  <div className="text-xl font-bold">
                    {selectedPassAssignments.length === 1
                      ? `You need ${passResult.neededEach.toFixed(1)}% on this item.`
                      : `You need a ${passResult.neededEach.toFixed(1)}% weighted average across these items.`}
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {selectedPassAssignments.length === 1
                      ? `That gets this course to about ${passResult.projectedMark.toFixed(1)}% overall.`
                      : `There are many combinations. Any mix whose weighted average is ${passResult.neededEach.toFixed(1)}% gets this course to about ${passResult.projectedMark.toFixed(1)}% overall.`}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-xl font-bold text-rose-600">
                    Sorry, this target is not reachable from the selected work.
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    You would need {passResult.neededEach.toFixed(1)}% on each selected item. Select more weighted work or lower the target.
                  </p>
                </div>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {selectedPassAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="font-medium">{assignment.title}</div>
                    <div className="mt-1 text-slate-500">
                      Weight {normalizeWeightToPercent(assignment.weight).toFixed(1)}%
                    </div>
                    <div className="mt-2 font-semibold">
                      {selectedPassAssignments.length === 1 ? "Need " : "Equal-score plan "}
                      {passResult.alreadySafe
                        ? "0.0"
                        : passResult.possible
                        ? passResult.neededEach.toFixed(1)
                        : ">100"}
                      %
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="course-detail-dim grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-slate-500" />
            <span className="font-semibold">Completed weighted</span>
          </div>
          <div className="flex items-center gap-4">
            <Donut value={metrics.displayCompleted} />
            <div className="min-w-0">
              <div className="text-3xl font-semibold tabular-nums">
                {metrics.displayCompleted.toFixed(1)}%
              </div>
              <div className="text-sm text-slate-500">
                Total weights {metrics.totalWeights.toFixed(1)}%
              </div>
              {Math.abs(metrics.totalWeights - 100) > 0.01 && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Weights do not sum to 100%
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-500" />
            <span className="font-semibold">Grade so far</span>
          </div>
          <div className="text-3xl font-semibold tabular-nums">
            {metrics.gradeSoFar == null
              ? "--"
              : `${metrics.gradeSoFar.toFixed(1)}%`}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Completed work with grades.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-500" />
            <span className="font-semibold">Current mark</span>
          </div>
          <div className="text-3xl font-semibold tabular-nums">
            {metrics.currentMark.toFixed(1)}%
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Ungraded work counts as zero.
          </p>
        </div>
      </div>

      <CourseGpaSettings course={course} />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-slate-500" />
            <h2 className="font-semibold">Assignments</h2>
            <Badge>{course.assignments.length}</Badge>
          </div>
          <div className="grid w-full gap-2 md:w-auto md:grid-cols-[220px_160px_150px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="pl-9"
              />
            </div>
            <SelectBox
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as "all" | AssignmentStatus)}
            >
              <option value="all">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectBox>
            <SelectBox value={sortMode} onChange={setSortMode}>
              <option value="due">Sort by due date</option>
              <option value="status">Sort by status</option>
              <option value="weight">Sort by weight</option>
            </SelectBox>
          </div>
        </div>

        <div className="space-y-3">
          {course.assignments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
              No assignments yet
            </div>
          ) : visibleAssignments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
              No matching assignments
            </div>
          ) : (
            visibleAssignments.map((assignment) => (
              <AssignmentRow
                key={assignment.id}
                a={assignment}
                onChange={(patch) => update(course.id, assignment.id, patch)}
                onRemove={() => remove(course.id, assignment.id)}
                onDuplicate={() => duplicateAssignment(course.id, assignment.id)}
                passSelectMode={passMode}
                passSelected={passSelectedIds.has(assignment.id)}
                onPassToggle={() => {
                  setPassResult(null);
                  setPassSelectedIds((current) => {
                    const next = new Set(current);
                    if (next.has(assignment.id)) next.delete(assignment.id);
                    else next.add(assignment.id);
                    return next;
                  });
                }}
              />
            ))
          )}
        </div>
      </section>

      <AddAssignmentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        courseId={course.id}
        initialMode={assignmentMode}
      />
    </main>
  );
}

/* ==========================
   Calendar
========================== */
function QuickAddModal({
  open,
  onClose,
  initialDate,
  defaultCourseId,
}: {
  open: boolean;
  onClose: () => void;
  initialDate: string | null;
  defaultCourseId: string | null;
}) {
  const courses = useCourseStore((s) => s.courses);
  const addAssignment = useCourseStore((s) => s.addAssignment);
  const [courseId, setCourseId] = useState(defaultCourseId ?? courses[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const nextCourse =
      defaultCourseId && courses.some((course) => course.id === defaultCourseId)
        ? defaultCourseId
        : courses[0]?.id ?? "";
    setCourseId(nextCourse);
    setTitle("");
    setWeight("");
    setError("");
    window.setTimeout(() => titleRef.current?.focus(), 0);
  }, [courses, defaultCourseId, open]);

  return (
    <Modal open={open} onClose={onClose} title={`Add to ${initialDate ?? ""}`} width="max-w-lg">
      {courses.length === 0 ? (
        <div className="text-sm text-slate-500">Add a course first.</div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const parsedWeight =
              weight.trim() === "" ? 0 : parseFlexibleNumber(weight);
            if (!title.trim()) {
              setError("Title is required");
              return;
            }
            if (parsedWeight == null || parsedWeight < 0) {
              setError("Check the weight");
              return;
            }
            if (!initialDate) return;
            addAssignment(courseId, {
              title: title.trim(),
              dueDate: initialDate,
              weight: parsedWeight,
              status: "not_started",
              grade: null,
            });
            onClose();
          }}
          noValidate
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Course</FieldLabel>
              <SelectBox value={courseId} onChange={setCourseId}>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </SelectBox>
            </div>
            <div>
              <FieldLabel>Weight</FieldLabel>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="15 or 1/5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>
          <div>
            <FieldLabel>Assignment title</FieldLabel>
            <Input
              ref={titleRef}
              type="text"
              placeholder="Lab report"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError("");
              }}
              autoFocus
            />
            {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function CalendarPanel({
  onOpenCourse,
}: {
  onOpenCourse: (courseId: string) => void;
}) {
  const courses = useCourseStore((s) => s.courses);
  const folders = useCourseStore((s) => s.folders);
  const theme = useCourseStore((s) => s.calendarTheme);
  const setTheme = useCourseStore((s) => s.setCalendarTheme);
  const updateAssignment = useCourseStore((s) => s.updateAssignment);
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AssignmentStatus>("all");
  const [quickDate, setQuickDate] = useState<string | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<{
    courseId: string;
    assignmentId: string;
  } | null>(null);

  const foldersById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders]
  );

  const calendarItems = useMemo(() => {
    return courses.flatMap((course) => {
      const folder = course.folderId ? foldersById.get(course.folderId) ?? null : null;
      return course.assignments
        .filter((assignment) => assignment.dueDate)
        .filter((assignment) => {
          const matchesQuery = smartSearchMatch(
            [
              assignment.title,
              course.name,
              folderDisplayName(folder),
              folder?.name,
              folder?.year,
            ],
            query
          );
          const matchesFolder =
            folderFilter === "all" ||
            (folderFilter === "unfiled" && !course.folderId) ||
            course.folderId === folderFilter;
          const matchesStatus =
            statusFilter === "all" || assignment.status === statusFilter;
          return matchesQuery && matchesFolder && matchesStatus;
        })
        .map((assignment) => ({ course, folder, assignment }));
    });
  }, [courses, folderFilter, foldersById, query, statusFilter]);

  const events = useMemo(
    () =>
      calendarItems.map(({ course, folder, assignment }) => {
        const color = course.color || folder?.color || DEFAULT_COLORS[0];
        return {
          id: assignment.id,
          title: assignment.title || "Untitled",
          start: assignment.dueDate as string,
          allDay: true,
          backgroundColor:
            assignment.status === "completed"
              ? hexToRgba("#22c55e", 0.16)
              : hexToRgba(color, 0.16),
          borderColor:
            assignment.status === "overdue"
              ? hexToRgba("#ef4444", 0.75)
              : hexToRgba(color, 0.42),
          textColor: "#0f172a",
          className: [`mm-event-${assignment.status}`],
          extendedProps: {
            courseId: course.id,
            courseName: course.name,
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
            status: assignment.status,
            color,
            folderName: folder?.name ?? "No semester",
            weight: normalizeWeightToPercent(assignment.weight),
          },
        };
      }),
    [calendarItems]
  );

  const upcoming = useMemo(
    () =>
      calendarItems
        .filter(({ assignment }) => assignment.status !== "completed")
        .slice()
        .sort((a, b) => compareDue(a.assignment, b.assignment))
        .slice(0, 10),
    [calendarItems]
  );

  const selected = useMemo(() => {
    if (!selectedAssignment) return null;
    const course = courses.find((c) => c.id === selectedAssignment.courseId);
    const assignment = course?.assignments.find(
      (a) => a.id === selectedAssignment.assignmentId
    );
    if (!course || !assignment) return null;
    const folder = course.folderId ? foldersById.get(course.folderId) : null;
    return { course, assignment, folder };
  }, [courses, foldersById, selectedAssignment]);

  const semesterOptions = useMemo(() => {
    const datedCount = (courseList: Course[]) =>
      courseList.reduce(
        (sum, course) =>
          sum + course.assignments.filter((assignment) => assignment.dueDate).length,
        0
      );
    return [
      { id: "all", label: "All deadlines", count: datedCount(courses) },
      {
        id: "unfiled",
        label: "No semester",
        count: datedCount(courses.filter((course) => !course.folderId)),
      },
      ...folders.map((folder) => ({
        id: folder.id,
        label: folderDisplayName(folder),
        count: datedCount(courses.filter((course) => course.folderId === folder.id)),
        color: folder.color,
      })),
    ];
  }, [courses, folders]);

  const activeSemesterLabel =
    semesterOptions.find((option) => option.id === folderFilter)?.label ??
    "All deadlines";

  const defaultQuickCourse =
    folderFilter !== "all" && folderFilter !== "unfiled"
      ? courses.find((course) => course.folderId === folderFilter)?.id ?? null
      : folderFilter === "unfiled"
      ? courses.find((course) => !course.folderId)?.id ?? null
      : courses[0]?.id ?? null;

  const themeClass =
    theme === "highContrast"
      ? "calendar-high-contrast"
      : theme === "pastel"
      ? "calendar-pastel"
      : theme === "minimal"
      ? "calendar-minimal"
      : theme === "academic"
      ? "calendar-academic"
      : theme === "deadline"
      ? "calendar-deadline"
      : "";

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-5">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search deadlines, courses, or semesters"
              className="pl-9 lg:w-[22rem]"
            />
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {[
              { id: "all", label: "All" },
              { id: "overdue", label: "Overdue" },
              { id: "not_started", label: "To do" },
              { id: "in_progress", label: "Started" },
              { id: "completed", label: "Done" },
            ].map((option) => {
              const active = statusFilter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`min-h-10 rounded-full border px-3 text-sm font-bold transition ${
                    active
                      ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                  }`}
                  onClick={() =>
                    setStatusFilter(option.id as "all" | AssignmentStatus)
                  }
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <SelectBox
            value={theme}
            onChange={(v) => setTheme(v as CalendarTheme)}
            className="lg:w-44"
          >
            <option value="system">System style</option>
            <option value="pastel">Pastel</option>
            <option value="highContrast">High Contrast</option>
            <option value="minimal">Minimal</option>
            <option value="academic">Academic</option>
            <option value="deadline">Deadline</option>
          </SelectBox>
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Semester focus
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Showing {activeSemesterLabel}
              </div>
            </div>
            <Badge>{calendarItems.length} visible</Badge>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {semesterOptions.map((option) => {
              const active = folderFilter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-bold transition ${
                    active
                      ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                  }`}
                  onClick={() => setFolderFilter(option.id as FolderFilter)}
                >
                  {"color" in option && option.color && (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  {option.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      active
                        ? "bg-white/20 text-white dark:bg-slate-950/10 dark:text-slate-700"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                    }`}
                  >
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section
          className={`calendar-shell rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950 ${themeClass}`}
        >
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="auto"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "",
            }}
            dayMaxEventRows={4}
            moreLinkClick="popover"
            fixedWeekCount={false}
            events={events as any}
            eventOrder={(a: any, b: any) => {
              const statusA = a.extendedProps?.status as AssignmentStatus;
              const statusB = b.extendedProps?.status as AssignmentStatus;
              return STATUS_ORDER[statusA] - STATUS_ORDER[statusB];
            }}
            dateClick={(arg: any) => setQuickDate(arg.dateStr)}
            eventClick={(arg: any) => {
              const courseId = arg.event.extendedProps?.courseId as string;
              const assignmentId = arg.event.extendedProps?.assignmentId as string;
              setSelectedAssignment({ courseId, assignmentId });
            }}
            eventDidMount={(info: any) => {
              const p = info.event.extendedProps || {};
              info.el.setAttribute(
                "title",
                `${p.courseName ?? ""}: ${p.assignmentTitle ?? ""}`
              );
            }}
            eventContent={(arg: any) => {
              const p = arg.event.extendedProps || {};
              return (
                <span className="mm-event-content">
                  <span
                    className="mm-event-dot"
                    style={{ backgroundColor: p.color || DEFAULT_COLORS[0] }}
                  />
                  <span className="mm-event-title">{arg.event.title}</span>
                  <span className="mm-event-course">{p.courseName}</span>
                </span>
              );
            }}
          />
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <h2 className="font-semibold">Agenda</h2>
              </div>
              <Badge>{calendarItems.length}</Badge>
            </div>
            <div className="space-y-2">
              {upcoming.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">
                  Nothing upcoming
                </div>
              ) : (
                upcoming.map(({ course, assignment }) => (
                  <button
                    key={`${course.id}-${assignment.id}`}
                    type="button"
                    onClick={() =>
                      setSelectedAssignment({
                        courseId: course.id,
                        assignmentId: assignment.id,
                      })
                    }
                    className="w-full rounded-md border border-slate-200 p-3 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {assignment.title}
                      </span>
                      <Badge intent={dueTone(assignment.dueDate, assignment.status) as any}>
                        {dueLabel(assignment.dueDate, assignment.status)}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: course.color ?? DEFAULT_COLORS[0],
                        }}
                      />
                      <span className="truncate">{course.name}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center gap-2">
              <Info className="h-4 w-4 text-slate-500" />
              <h2 className="font-semibold">Selected</h2>
            </div>
            {selected ? (
              <div className="space-y-3">
                <div>
                  <div className="text-lg font-semibold">
                    {selected.assignment.title}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {selected.course.name}
                    {selected.folder ? ` / ${selected.folder.name}` : ""}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-900">
                    <div className="text-xs text-slate-500">Due</div>
                    <div className="font-medium">
                      {formatDueDate(selected.assignment.dueDate)}
                    </div>
                  </div>
                  <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-900">
                    <div className="text-xs text-slate-500">Weight</div>
                    <div className="font-medium">
                      {normalizeWeightToPercent(selected.assignment.weight).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      updateAssignment(selected.course.id, selected.assignment.id, {
                        status: "completed",
                      })
                    }
                  >
                    <Check className="h-4 w-4" />
                    Complete
                  </Button>
                  <Button onClick={() => onOpenCourse(selected.course.id)}>
                    Open course
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700">
                Pick a calendar item
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {courses.map((course) => (
              <span
                key={course.id}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-950"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: course.color ?? DEFAULT_COLORS[0] }}
                />
                {course.name}
              </span>
            ))}
          </div>
        </aside>
      </div>

      <QuickAddModal
        open={quickDate !== null}
        onClose={() => setQuickDate(null)}
        initialDate={quickDate}
        defaultCourseId={defaultQuickCourse}
      />
    </main>
  );
}

/* ==========================
   Welcome Home
========================== */
function WelcomeHome({
  appMode,
  onChooseUniversity,
  onChooseCustom,
  universityThemeId,
  setUniversityTheme,
  customThemeId,
  setCustomTheme,
}: {
  appMode: AppMode;
  onChooseUniversity: () => void;
  onChooseCustom: () => void;
  universityThemeId: UniversityThemeId;
  setUniversityTheme: (t: UniversityThemeId) => void;
  customThemeId: CustomThemeId;
  setCustomTheme: (t: CustomThemeId) => void;
}) {
  const selectedUniversityTheme =
    UNIVERSITY_THEMES[universityThemeId === "markmate" ? "uoft" : universityThemeId];
  const selectedCustomTheme = CUSTOM_THEMES[customThemeId];
  const brandPalette = getMarkMateBrandPalette(
    appMode,
    universityThemeId,
    customThemeId
  );

  return (
    <main className="home-page relative mx-auto max-w-7xl px-4 py-8 md:py-10">
      <section className="old-home-card rounded-lg border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-950 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.86fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
              <MarkMateLogo size="xs" />
              Choose your MarkMate setup
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Welcome to{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(90deg, ${brandPalette.wordStart}, ${brandPalette.wordMid}, ${brandPalette.wordEnd})`,
                }}
              >
                MarkMate
              </span>
            </h1>
            <p className="mt-3 max-w-prose text-slate-600 dark:text-slate-300">
              Your cute, colorful space to plan assignments, track progress, and
              celebrate wins. Add courses, sort them by semester, and let the
              rings keep score.
            </p>
            <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
              <div className="home-feature rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="font-semibold">Plan</div>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  Add assignments with due dates and weights.
                </p>
              </div>
              <div className="home-feature rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="font-semibold">Track</div>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  See your current mark and what is still waiting.
                </p>
              </div>
              <div className="home-feature rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="font-semibold">Pass</div>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  When weights hit 100%, ask what you need to pass.
                </p>
              </div>
            </div>
          </div>
          <div className="w-full space-y-4">
            <div
              className="home-preview-card rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              style={{
                backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${brandPalette.wordStart} 10%, white), color-mix(in srgb, ${brandPalette.wordMid} 8%, white) 48%, color-mix(in srgb, ${brandPalette.wordEnd} 12%, white))`,
              }}
            >
              <div className="flex items-center gap-4">
                <Donut value={72} size={106} label="Ready" />
                <div className="min-w-0">
                  <div className="text-lg font-semibold">Your progress ring</div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    It changes color as you level up. Finish a course and
                    MarkMate makes it feel like a win.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="text-xs text-slate-500">Current Mark</div>
                  <div className="text-xl font-semibold">--%</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="text-xs text-slate-500">Grade So Far</div>
                  <div className="text-xl font-semibold">--%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.03fr_0.97fr]">
        <article
          className={`mode-card mode-card-university rounded-lg border p-5 ${
            appMode === "university" ? "mode-card-active" : ""
          }`}
          role="button"
          tabIndex={0}
          onClick={onChooseUniversity}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onChooseUniversity();
            }
          }}
          style={
            {
              "--mode-primary": selectedUniversityTheme.primaryColor,
              "--mode-accent": selectedUniversityTheme.accentColor,
              "--mode-theme-image": `url(${selectedUniversityTheme.backgroundImage})`,
            } as React.CSSProperties
          }
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">
                <MarkMateLogo size="xs" />
                University mode
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight">
                Start with a real school rhythm.
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                Four years are ready for you, each with Fall, Winter, and
                Summer. Pick a school theme and MarkMate keeps the campus feel
                subtle in the background.
              </p>
            </div>
            <div className="w-full max-w-xs">
              <FieldLabel>School theme</FieldLabel>
              <SelectBox
                value={selectedUniversityTheme.id}
                onChange={(value) => setUniversityTheme(value as UniversityThemeId)}
                onClick={(event) => event.stopPropagation()}
                className="bg-white/80"
              >
                {REAL_UNIVERSITY_THEME_OPTIONS.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.label}
                  </option>
                ))}
              </SelectBox>
            </div>
          </div>
          <Button onClick={onChooseUniversity} className="mt-5">
            <Rocket className="h-4 w-4" />
            Use university mode
          </Button>
        </article>

        <article
          className={`mode-card mode-card-custom rounded-lg border p-5 ${
            appMode === "custom" ? "mode-card-active" : ""
          }`}
          role="button"
          tabIndex={0}
          onClick={onChooseCustom}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onChooseCustom();
            }
          }}
          style={
            {
              "--mode-primary": selectedCustomTheme.primaryColor,
              "--mode-accent": selectedCustomTheme.accentColor,
              "--mode-image": "none",
            } as React.CSSProperties
          }
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Custom mode
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight">
                Build your own academic map.
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                Create any years, semesters, blocks, or terms you want. No
                university wallpaper, just polished MarkMate templates that stay
                out of your way.
              </p>
            </div>
            <div className="w-full max-w-xs">
              <FieldLabel>MarkMate template</FieldLabel>
              <SelectBox
                value={customThemeId}
                onChange={(value) => setCustomTheme(value as CustomThemeId)}
                onClick={(event) => event.stopPropagation()}
                className="bg-white/80"
              >
                {CUSTOM_THEME_OPTIONS.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.label}
                  </option>
                ))}
              </SelectBox>
              <p className="mt-2 text-xs text-slate-500">
                {selectedCustomTheme.tagline}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {CUSTOM_THEME_OPTIONS.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`custom-swatch ${
                  customThemeId === theme.id ? "custom-swatch-active" : ""
                }`}
                style={
                  {
                    "--mode-primary": theme.primaryColor,
                    "--mode-accent": theme.accentColor,
                  } as React.CSSProperties
                }
                onClick={(event) => {
                  event.stopPropagation();
                  setCustomTheme(theme.id);
                }}
                title={theme.label}
              />
            ))}
          </div>
          <Button onClick={onChooseCustom} className="mt-5">
            <FolderPlus className="h-4 w-4" />
            Use custom mode
          </Button>
        </article>
      </section>
    </main>
  );
}

/* ==========================
   Main App
========================== */
export default function DesktopApp() {
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [defaultFolderId, setDefaultFolderId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [lastViewedFolderId, setLastViewedFolderId] = useState<string | null>(null);
  const [showHome, setShowHome] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "calendar">("dashboard");
  const courses = useCourseStore((s) => s.courses);
  const folders = useCourseStore((s) => s.folders);
  const appMode = useCourseStore((s) => s.appMode ?? "custom");
  const setAppMode = useCourseStore((s) => s.setAppMode);
  const universityThemeId = useCourseStore((s) => s.universityThemeId ?? "uoft");
  const setUniversityTheme = useCourseStore((s) => s.setUniversityTheme);
  const customThemeId = useCourseStore((s) => s.customThemeId ?? "classic");
  const setCustomTheme = useCourseStore((s) => s.setCustomTheme);
  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const activeTheme = getActiveTheme(appMode, universityThemeId, customThemeId);
  const brandPalette = getMarkMateBrandPalette(
    appMode,
    universityThemeId,
    customThemeId
  );

  useEffect(() => {
    if (appMode !== "university" || hasLockedUniversitySemesters(folders)) {
      return;
    }
    const lockedFolders = createLockedUniversitySemesters(folders);
    useCourseStore.setState((state) => ({
      folders: lockedFolders,
      courses: clearInvalidCourseSemesters(state.courses, lockedFolders),
    }));
  }, [appMode, folders]);

  useEffect(() => {
    if (selectedCourseId && !selectedCourse) setSelectedCourseId(null);
  }, [selectedCourse, selectedCourseId]);

  const openAddCourse = (folderId: string | null) => {
    setDefaultFolderId(folderId);
    setAddCourseOpen(true);
  };

  const handleTab = (next: "dashboard" | "calendar") => {
    setSelectedCourseId(null);
    setShowHome(false);
    setTab(next);
  };

  const chooseUniversityMode = () => {
    setAppMode("university");
    setShowHome(false);
    setSelectedCourseId(null);
    setTab("dashboard");
  };

  const chooseCustomMode = () => {
    setAppMode("custom");
    setShowHome(false);
    setSelectedCourseId(null);
    setTab("dashboard");
  };

  return (
    <div
      className="app-shell min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50"
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
      <TopBar
        onAddCourse={() => openAddCourse(null)}
        onAddFolder={() => setAddFolderOpen(true)}
        onHome={() => {
          setSelectedCourseId(null);
          setShowHome(true);
          setTab("dashboard");
        }}
        tab={tab}
        setTab={handleTab}
        isHome={showHome}
        appMode={appMode}
        setAppMode={setAppMode}
        universityThemeId={universityThemeId}
        setUniversityTheme={setUniversityTheme}
        customThemeId={customThemeId}
        setCustomTheme={setCustomTheme}
      />
      <CelebrationCenter />

      {selectedCourse ? (
        <CourseDetail
          course={selectedCourse}
          onBack={() => {
            setLastViewedFolderId(selectedCourse.folderId ?? null);
            setSelectedCourseId(null);
            setShowHome(false);
          }}
        />
      ) : showHome ? (
        <WelcomeHome
          appMode={appMode}
          onChooseUniversity={chooseUniversityMode}
          onChooseCustom={chooseCustomMode}
          universityThemeId={universityThemeId}
          setUniversityTheme={setUniversityTheme}
          customThemeId={customThemeId}
          setCustomTheme={setCustomTheme}
        />
      ) : tab === "calendar" ? (
        <CalendarPanel
          onOpenCourse={(courseId) => {
            const course = courses.find((item) => item.id === courseId);
            setLastViewedFolderId(course?.folderId ?? null);
            setSelectedCourseId(courseId);
            setShowHome(false);
            setTab("dashboard");
          }}
        />
      ) : (
        <Dashboard
          onOpenCourse={(courseId) => {
            setShowHome(false);
            const course = courses.find((item) => item.id === courseId);
            setLastViewedFolderId(course?.folderId ?? null);
            setSelectedCourseId(courseId);
          }}
          onAddCourse={openAddCourse}
          onAddFolder={() => setAddFolderOpen(true)}
          focusFolderId={lastViewedFolderId}
        />
      )}

      <AddCourseModal
        open={addCourseOpen}
        onClose={() => setAddCourseOpen(false)}
        defaultFolderId={defaultFolderId}
        onCreated={(courseId) => {
          const course = useCourseStore
            .getState()
            .courses.find((item) => item.id === courseId);
          setLastViewedFolderId(course?.folderId ?? null);
          setShowHome(false);
          setTab("dashboard");
          setSelectedCourseId(courseId);
        }}
      />
      <AddSemesterModal
        open={addFolderOpen}
        onClose={() => setAddFolderOpen(false)}
      />
    </div>
  );
}
