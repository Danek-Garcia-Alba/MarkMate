import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { haptic } from "ios-haptics";
import { useDrag } from "@use-gesture/react";
import { animated, to as springTo, useSpring } from "@react-spring/web";
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
  Medal,
  PartyPopper,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
  Smartphone,
  Target,
  Trash2,
  Trophy,
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

type MobileCourseReturnContext = {
  scopeId?: string | null;
  year?: string | null;
};

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

const installGuideSlides = [
  {
    src: "/install-guide/step-1.png",
    alt: "Step 1: tap Share to install MarkMate",
  },
  {
    src: "/install-guide/step-2.png",
    alt: "Step 2: choose Add to Home Screen",
  },
  {
    src: "/install-guide/step-3.png",
    alt: "Step 3: name the app MarkMate",
  },
  {
    src: "/install-guide/step-4.png",
    alt: "Step 4: tap Add",
  },
  {
    src: "/install-guide/step-5.png",
    alt: "Step 5: open MarkMate from your Home Screen",
  },
  {
    src: "/install-guide/step-6.png",
    alt: "Step 6: phone mode enabled",
  },
] as const;

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
  "#0e7490",
  "#a16207",
  "#9333ea",
  "#dc2626",
] as const;

const MOBILE_MODE_SNAPSHOT_KEY = "markmate-mobile-mode-snapshots-v1";

type MobileModeSnapshot = {
  courses: Course[];
  folders: CourseFolder[];
};

function readMobileModeSnapshots(): Partial<
  Record<"custom" | "university", MobileModeSnapshot>
> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MOBILE_MODE_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMobileModeSnapshots(
  snapshots: Partial<Record<"custom" | "university", MobileModeSnapshot>>
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MOBILE_MODE_SNAPSHOT_KEY, JSON.stringify(snapshots));
  } catch {
    // Ignore storage failures so mode switching still works.
  }
}

function switchMobileAppMode(nextMode: "custom" | "university") {
  const state = useCourseStore.getState();
  const currentMode = state.appMode ?? "custom";
  const snapshots = readMobileModeSnapshots();

  snapshots[currentMode] = {
    courses: state.courses,
    folders: state.folders,
  };
  writeMobileModeSnapshots(snapshots);

  if (nextMode === currentMode) return;

  const saved = snapshots[nextMode];
  if (nextMode === "custom") {
    const savedCourses = saved?.courses ?? [];
    const savedFolders =
      savedCourses.length === 0 && isUniversityLikeFolderSet(saved?.folders ?? [])
        ? []
        : saved?.folders ?? [];
    useCourseStore.setState({
      appMode: "custom",
      courses: savedCourses,
      folders: savedFolders,
    });
    return;
  }

  useCourseStore.setState({
    appMode: "custom",
    courses: saved?.courses ?? [],
    folders: saved?.folders ?? [],
  });
  useCourseStore.getState().setAppMode("university");
}

function nextCustomYearName(folders: CourseFolder[]) {
  const used = new Set(folders.map((folder) => folder.year).filter(Boolean));
  for (let index = 1; index < 20; index += 1) {
    const label = `Year ${index}`;
    if (!used.has(label)) return label;
  }
  return `Year ${used.size + 1}`;
}

function isUniversityLikeFolderSet(folders: CourseFolder[]) {
  if (folders.length !== semesterYears.length * semesterTerms.length) return false;
  const keys = new Set(
    folders.map((folder) => `${folder.year ?? ""}:${folder.name}`)
  );
  return semesterYears.every((year) =>
    semesterTerms.every((term) => keys.has(`${year}:${term}`))
  );
}

function removeCustomYear(year: string) {
  useCourseStore.setState((state) => {
    if (state.appMode === "university") return {};
    const folderIds = new Set(
      state.folders
        .filter((folder) => (folder.year?.trim() || "Unfiled") === year)
        .map((folder) => folder.id)
    );
    if (folderIds.size === 0) return {};
    return {
      folders: state.folders.filter((folder) => !folderIds.has(folder.id)),
      courses: state.courses.map((course) =>
        course.folderId && folderIds.has(course.folderId)
          ? { ...course, folderId: null }
          : course
      ),
    };
  });
}

function groupFoldersByYear(folders: CourseFolder[]) {
  const grouped = new Map<string, CourseFolder[]>();
  folders.slice().sort(folderSort).forEach((folder) => {
    const year = folder.year?.trim() || "Unfiled";
    grouped.set(year, [...(grouped.get(year) ?? []), folder]);
  });
  return Array.from(grouped.entries()).map(([year, items]) => ({
    year,
    folders: items,
  }));
}

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

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function isLikelyIOSDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function useStandalonePwa() {
  const [standalone, setStandalone] = useState(isStandalonePwa);

  useEffect(() => {
    const update = () => setStandalone(isStandalonePwa());
    const media = window.matchMedia("(display-mode: standalone)");
    update();
    media.addEventListener?.("change", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      media.removeEventListener?.("change", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return standalone;
}

function useMobileKeyboardOpen() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      const active = document.activeElement;
      const editing =
        active instanceof HTMLElement &&
        Boolean(active.closest("input, textarea, select"));
      setKeyboardOpen(editing && viewport.height < window.innerHeight * 0.82);
    };

    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("focusin", update);
    window.addEventListener("focusout", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("focusin", update);
      window.removeEventListener("focusout", update);
    };
  }, []);

  return keyboardOpen;
}

function blurActiveMobileControl() {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

function isSwipeBlockingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, a, [contenteditable='true'], [data-no-swipe='true'], [data-page-swipe-block='true']"
    )
  );
}

function isSwipeExitBlockingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, a, [contenteditable='true'], [data-no-swipe='true']"
    )
  );
}

function isSheetDragBlockingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      "button, input, textarea, select, a, [contenteditable='true'], [data-sheet-drag-block='true']"
    )
  );
}

function sheetScrollParent(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return null;
  return target.closest("[data-mobile-scroll='true']") as HTMLElement | null;
}

const IOS_PAGE_SPRING = { tension: 1040, friction: 52, mass: 0.5 };
const IOS_SHEET_SPRING = { tension: 900, friction: 54, mass: 0.54 };
const SWIPE_LOCK_MS = 72;
let pageSwipePausedUntil = 0;

type MobileHapticKind = "selection" | "mode" | "open" | "success" | "boundary";

function triggerMobileHaptic(kind: MobileHapticKind = "selection") {
  if (typeof window === "undefined") return;
  const patterns: Record<MobileHapticKind, number | number[]> = {
    selection: 8,
    mode: [10, 22, 8],
    open: 12,
    success: [14, 28, 16],
    boundary: 10,
  };
  const maybeNative = window as Window & {
    webkit?: {
      messageHandlers?: {
        markMateHaptics?: { postMessage: (payload: { kind: MobileHapticKind }) => void };
      };
    };
    Capacitor?: {
      Plugins?: {
        Haptics?: {
          impact?: (options?: { style?: string }) => void;
          selectionChanged?: () => void;
          notification?: (options?: { type?: string }) => void;
        };
      };
    };
  };

  try {
    if (kind === "success" || kind === "mode") {
      haptic.confirm();
    } else {
      haptic();
    }
  } catch {
    // The iOS haptic helper is best-effort and falls through to native/browser bridges.
  }

  try {
    maybeNative.webkit?.messageHandlers?.markMateHaptics?.postMessage({ kind });
    if (kind === "success") {
      maybeNative.Capacitor?.Plugins?.Haptics?.notification?.({ type: "SUCCESS" });
    } else if (kind === "selection" || kind === "boundary") {
      maybeNative.Capacitor?.Plugins?.Haptics?.selectionChanged?.();
    } else {
      maybeNative.Capacitor?.Plugins?.Haptics?.impact?.({ style: "LIGHT" });
    }
  } catch {
    // Native haptic bridges are optional; browser vibration is the web fallback below.
  }
  window.navigator.vibrate?.(patterns[kind]);
  window.dispatchEvent(new CustomEvent("markmate:haptic", { detail: { kind } }));
}

function pausePageSwipe(ms = 180) {
  pageSwipePausedUntil = Math.max(pageSwipePausedUntil, Date.now() + ms);
}

function isPageSwipePaused() {
  return Date.now() < pageSwipePausedUntil;
}

function viewportWidth() {
  return typeof window === "undefined" ? 390 : window.innerWidth;
}

function viewportHeight() {
  return typeof window === "undefined" ? 844 : window.innerHeight;
}

function isPageSwipeAllowedFrom(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("[data-allow-page-swipe='true']"));
}

function useHorizontalSwipeExit(onExit: () => void, enabled = true) {
  const onExitRef = useRef(onExit);
  const lockRef = useRef(false);
  const fallbackStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    active: boolean;
  } | null>(null);
  const [{ x, opacity }, api] = useSpring(() => ({
    x: 0,
    opacity: 1,
    config: IOS_PAGE_SPRING,
  }));

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    if (!enabled) api.set({ x: 0, opacity: 1 });
  }, [api, enabled]);

  const completeExit = (
    movementX: number,
    movementY: number,
    velocityX: number,
    directionX: number
  ) => {
    if (!enabled || lockRef.current) return;
    const absX = Math.abs(movementX);
    const absY = Math.abs(movementY);
    const nextX = Math.max(0, movementX);
    const horizontalIntent = absX > 7 && absX > absY * 1.1;
    const shouldComplete =
      horizontalIntent &&
      directionX > 0 &&
      (nextX > viewportWidth() * 0.115 || (nextX > 18 && velocityX > 0.2));

    if (shouldComplete) {
      lockRef.current = true;
      pausePageSwipe();
      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        onExitRef.current();
        window.setTimeout(() => {
          lockRef.current = false;
        }, SWIPE_LOCK_MS);
      };
      api.start({
        x: viewportWidth(),
        opacity: 0.92,
        config: { tension: 1180, friction: 54, mass: 0.48 },
        onRest: () => {
          api.set({ x: 0, opacity: 1 });
          commit();
        },
      });
      window.setTimeout(commit, 8);
      return;
    }

    api.start({ x: 0, opacity: 1, config: IOS_PAGE_SPRING });
  };

  const bind = useDrag(
    ({
      active,
      cancel,
      direction: [dirX],
      event,
      first,
      last,
      movement: [mx, my],
      velocity: [vx],
      xy: [pointerX],
    }) => {
      if (!enabled || lockRef.current) return;
      if (isPageSwipePaused()) {
        api.start({ x: 0, opacity: 1, immediate: true });
        return;
      }
      if (first && isSwipeExitBlockingTarget(event.target) && pointerX > 44) {
        cancel();
        return;
      }

      const absX = Math.abs(mx);
      const absY = Math.abs(my);
      const horizontalIntent = absX > 7 && absX > absY * 1.1;
      const nextX = Math.max(0, mx);

      if (active) {
        if (!horizontalIntent) {
          api.start({ x: 0, opacity: 1, immediate: true });
          return;
        }
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
        api.start({
          x: Math.min(nextX, viewportWidth() * 0.68),
          opacity: 1 - Math.min(nextX / viewportWidth(), 0.1),
          immediate: true,
        });
        return;
      }

      if (!last) return;

      completeExit(mx, my, vx, dirX);
    },
    {
      enabled,
      axis: "x",
      filterTaps: true,
      eventOptions: { passive: false },
    }
  );

  return {
    bind: () => ({
      ...(typeof bind === "function" ? bind() : {}),
      onPointerDownCapture: (event: React.PointerEvent<HTMLElement>) => {
        if (
          !enabled ||
          lockRef.current ||
          isPageSwipePaused() ||
          (isSwipeExitBlockingTarget(event.target) && event.clientX > 44)
        ) {
          fallbackStartRef.current = null;
          return;
        }
        fallbackStartRef.current = {
          x: event.clientX,
          y: event.clientY,
          time: Date.now(),
          active: true,
        };
      },
      onPointerMoveCapture: (event: React.PointerEvent<HTMLElement>) => {
        const start = fallbackStartRef.current;
        if (!enabled || !start?.active || lockRef.current || isPageSwipePaused()) {
          fallbackStartRef.current = null;
          api.start({ x: 0, opacity: 1, immediate: true });
          return;
        }
        const mx = event.clientX - start.x;
        const my = event.clientY - start.y;
        const absX = Math.abs(mx);
        const absY = Math.abs(my);
        const nextX = Math.max(0, mx);
        const horizontalIntent = absX > 7 && absX > absY * 1.1;
        if (!horizontalIntent || nextX <= 0) return;
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
        api.start({
          x: Math.min(nextX, viewportWidth() * 0.68),
          opacity: 1 - Math.min(nextX / viewportWidth(), 0.1),
          immediate: true,
        });
      },
      onPointerUpCapture: (event: React.PointerEvent<HTMLElement>) => {
        const start = fallbackStartRef.current;
        fallbackStartRef.current = null;
        if (!enabled || !start?.active || lockRef.current || isPageSwipePaused()) return;
        const mx = event.clientX - start.x;
        const my = event.clientY - start.y;
        const velocityX = Math.abs(mx) / Math.max(Date.now() - start.time, 1);
        completeExit(mx, my, velocityX, Math.sign(mx) || 1);
      },
      onPointerCancelCapture: () => {
        fallbackStartRef.current = null;
        api.start({ x: 0, opacity: 1, config: IOS_PAGE_SPRING });
      },
    }),
    x,
    opacity,
    style: {
      transform: x.to((value) => `translate3d(${value}px,0,0)`),
      opacity,
      touchAction: "pan-y",
    },
  };
}

function useHorizontalSwipeNavigation(
  activeIndex: number,
  totalTabs: number,
  onNext: () => void,
  onPrevious: () => void,
  enabled = true
) {
  const onNextRef = useRef(onNext);
  const onPreviousRef = useRef(onPrevious);
  const activeIndexRef = useRef(activeIndex);
  const totalTabsRef = useRef(totalTabs);
  const lockRef = useRef(false);
  const clickBlockUntilRef = useRef(0);
  const edgeHapticRef = useRef(false);
  const [{ x, opacity }, api] = useSpring(() => ({
    x: 0,
    opacity: 1,
    config: IOS_PAGE_SPRING,
  }));

  useEffect(() => {
    onNextRef.current = onNext;
    onPreviousRef.current = onPrevious;
    activeIndexRef.current = activeIndex;
    totalTabsRef.current = totalTabs;
  }, [activeIndex, onNext, onPrevious, totalTabs]);

  useEffect(() => {
    if (!enabled) {
      api.set({ x: 0, opacity: 1 });
    }
  }, [api, enabled]);

  const canMove = (direction: "next" | "previous") => {
    const index = activeIndexRef.current;
    return direction === "next"
      ? index < totalTabsRef.current - 1
      : index > 0;
  };

  const projectedX = (movementX: number) => {
    const width = viewportWidth();
    const direction = movementX < 0 ? "next" : "previous";
    if (canMove(direction)) {
      return Math.max(-width * 0.92, Math.min(width * 0.92, movementX));
    }
    const resisted = movementX * 0.22;
    return Math.max(-width * 0.16, Math.min(width * 0.16, resisted));
  };

  const resetNavigation = () => {
    api.start({
      x: 0,
      opacity: 1,
      config: IOS_PAGE_SPRING,
    });
  };

  const settleToCurrentTab = () => {
    api.start({
      x: 0,
      opacity: 1,
      config: { tension: 1120, friction: 56, mass: 0.45, clamp: true },
    });
  };

  const completeNavigation = (
    movementX: number,
    movementY: number,
    velocityX: number,
    directionX: number
  ) => {
    if (!enabled || lockRef.current) return;
    if (isPageSwipePaused()) {
      resetNavigation();
      return;
    }
    const absX = Math.abs(movementX);
    const absY = Math.abs(movementY);
    const horizontalIntent = absX > 7 && absX > absY * 1.1;
    const direction: "next" | "previous" =
      (directionX || movementX) < 0 ? "next" : "previous";
    const allowed = canMove(direction);
    const shouldMove =
      allowed &&
      horizontalIntent &&
      (absX > viewportWidth() * 0.105 || (absX > 18 && velocityX > 0.18));

    if (!shouldMove) {
      if (horizontalIntent && !allowed) triggerMobileHaptic("boundary");
      settleToCurrentTab();
      return;
    }

    const width = viewportWidth();
    const currentX = projectedX(movementX);
    const continuityX =
      direction === "next" ? width + currentX : -width + currentX;

    lockRef.current = true;
    clickBlockUntilRef.current = Date.now() + 260;

    triggerMobileHaptic("selection");
    flushSync(() => {
      if (direction === "next") onNextRef.current();
      else onPreviousRef.current();
    });

    api.set({ x: continuityX, opacity: 1 });
    api.start({
      x: 0,
      opacity: 1,
      config: { tension: 1180, friction: 54, mass: 0.42, clamp: true },
      onRest: () => {
        lockRef.current = false;
      },
    });
    window.setTimeout(() => {
      lockRef.current = false;
      if (!enabled) {
        api.set({ x: 0, opacity: 1 });
      }
    }, 360);
  };

  const bind = useDrag(
    ({
      active,
      cancel,
      direction: [dirX],
      event,
      first,
      last,
      movement: [mx, my],
      velocity: [vx],
    }) => {
      if (!enabled || lockRef.current) return;
      if (isPageSwipePaused()) {
        api.start({ x: 0, opacity: 1, immediate: true });
        return;
      }
      if (
        first &&
        isSwipeBlockingTarget(event.target) &&
        !isPageSwipeAllowedFrom(event.target)
      ) {
        cancel();
        return;
      }

      const absX = Math.abs(mx);
      const absY = Math.abs(my);
      const horizontalIntent = absX > 7 && absX > absY * 1.1;
      const direction: "next" | "previous" = mx < 0 ? "next" : "previous";
      const allowed = canMove(direction);
      const clampedX = projectedX(mx);

      if (active) {
        if (!horizontalIntent) {
          api.start({ x: 0, opacity: 1, immediate: true });
          return;
        }
        clickBlockUntilRef.current = Date.now() + 220;
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
        if (allowed) {
          edgeHapticRef.current = false;
        } else {
          if (!edgeHapticRef.current && absX > 24) {
            triggerMobileHaptic("boundary");
            edgeHapticRef.current = true;
          }
        }
        api.start({
          x: clampedX,
          opacity: 1,
          immediate: true,
        });
        return;
      }

      if (!last) return;
      edgeHapticRef.current = false;
      completeNavigation(mx, my, vx, dirX);
    },
    {
      enabled,
      axis: "x",
      filterTaps: true,
      eventOptions: { passive: false },
    }
  );

  return {
    bind: () => ({
      ...(typeof bind === "function" ? bind() : {}),
      onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
        if (Date.now() > clickBlockUntilRef.current) return;
        event.preventDefault();
        event.stopPropagation();
      },
    }),
    style: {
      transform: x.to((value) => `translate3d(${value}px,0,0)`),
      opacity,
      touchAction: "pan-y",
      willChange: "transform, opacity",
      backfaceVisibility: "hidden" as const,
      WebkitBackfaceVisibility: "hidden" as const,
    },
    previousStyle: {
      transform: x.to((value) => {
        const incoming = -viewportWidth() + value;
        return `translate3d(${Math.min(0, incoming)}px,0,0)`;
      }),
      opacity: x.to((value) =>
        value > 0 ? Math.min(1, Math.max(0.16, value / 120)) : 0
      ),
      touchAction: "pan-y",
      willChange: "transform, opacity",
      backfaceVisibility: "hidden" as const,
      WebkitBackfaceVisibility: "hidden" as const,
    },
    nextStyle: {
      transform: x.to((value) => {
        const incoming = viewportWidth() + value;
        return `translate3d(${Math.max(0, incoming)}px,0,0)`;
      }),
      opacity: x.to((value) =>
        value < 0 ? Math.min(1, Math.max(0.16, Math.abs(value) / 120)) : 0
      ),
      touchAction: "pan-y",
      willChange: "transform, opacity",
      backfaceVisibility: "hidden" as const,
      WebkitBackfaceVisibility: "hidden" as const,
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

type MobileIdentityInfo = {
  eyebrow: string;
  title: string;
  intro: string;
  facts: string[];
  closer: string;
};

const markMateIdentityInfo: MobileIdentityInfo = {
  eyebrow: "Built by students",
  title: "Why MarkMate exists",
  intro:
    "MarkMate started as the app we wished we had during the weeks when grades, deadlines, weights, and GPA rules were scattered everywhere.",
  facts: [
    "It is designed to make your semester feel less like a spreadsheet and more like a plan you can actually trust.",
    "The goal is simple: help students understand where they stand, what matters next, and what they need to do without digging through five tabs.",
    "We built it with the same pressure in mind that students feel every term, so the app should feel useful without feeling judgey.",
  ],
  closer:
    "You bring the courses. MarkMate keeps the math, timing, and little panic spirals under control.",
};

const universityIdentityInfo: Record<string, MobileIdentityInfo> = {
  uoft: {
    eyebrow: "Founded 1827",
    title: "University of Toronto",
    intro:
      "U of T is huge, urban, research-heavy, and built for students who want range as much as reputation.",
    facts: [
      "Three campuses, more than 100,000 students in 2024-25, and a scientific legacy that includes the isolation of insulin.",
      "The academic depth is real, which is why the UofTears nickname works as community comic relief instead of just a roast.",
      "This is the school where opportunities are enormous and your calendar may occasionally feel like it has developed a personality.",
    ],
    closer: "High standards, big city energy, and a lot of room to become dangerous at your thing.",
  },
  tmu: {
    eyebrow: "Founded 1948",
    title: "Toronto Metropolitan University",
    intro:
      "TMU is downtown, applied, career-focused, and unusually good at making the city feel like part of the classroom.",
    facts: [
      "Roughly 47,000 students in 2025-26, with a strong identity around innovation, entrepreneurship, and city building.",
      "The commuter realism is part of the personality: caffeine, transit timing, and turning downtown errands into networking.",
      "Its incubator reputation is serious, with thousands of startups helped and major funding raised.",
    ],
    closer: "TMU is practical city energy with a surprisingly sharp professional edge.",
  },
  york: {
    eyebrow: "Founded 1959",
    title: "York University",
    intro:
      "York is one of Canada's biggest and most diverse universities, with a modern GTA identity and serious breadth.",
    facts: [
      "More than 53,000 students from 160-plus countries study across Keele, Glendon, and Markham.",
      "Its strengths are scale, access, interdisciplinarity, social impact, and global perspective.",
      "The transit stories are basically a shared campus language, which somehow turns movement into community.",
    ],
    closer: "York feels like the GTA in university form: big, complex, and full of different routes in.",
  },
  western: {
    eyebrow: "Founded 1878",
    title: "Western University",
    intro:
      "Western is polished, research-intensive, high-achieving, and very comfortable with its own confidence.",
    facts: [
      "More than 42,000 students study across arts, sciences, health, law, engineering, business, and more.",
      "Its intellectual history includes Frederick Banting's insulin breakthrough note and cancer-treatment research milestones.",
      "The social stereotype is work-hard, play-hard, ideally with a case competition and weekend plan in the same phone folder.",
    ],
    closer: "Western is ambition with extrovert energy and a very organized calendar.",
  },
  guelph: {
    eyebrow: "Founded 1964",
    title: "University of Guelph",
    intro:
      "Guelph connects life sciences, food, environment, agriculture, business, wellness, and hands-on learning in a way that actually makes sense.",
    facts: [
      "It has more than 36,000 students, three campuses, and one of the world's most recognizable veterinary schools.",
      "The food reputation is not fake. People bring it up because it is genuinely part of the Guelph plot.",
      "Animals, sustainability, food systems, and wellness all fit the same campus personality.",
    ],
    closer: "Guelph is practical, warm, and probably better fed than everyone else.",
  },
  laurier: {
    eyebrow: "Founded 1911",
    title: "Wilfrid Laurier University",
    intro:
      "Laurier has a friendly, mid-sized feel with real strength in business, economics, social sciences, music, and career prep.",
    facts: [
      "About 23,600 students study across southern Ontario, anchored by Waterloo.",
      "Its business school is AACSB accredited, and Laurier highlights Canada's largest business-degree co-op program.",
      "The community vibe and social reputation fit together: warm, employable, and probably aware of the weekend plan already.",
    ],
    closer: "Laurier is approachable without being unserious, which is harder to pull off than it looks.",
  },
  waterloo: {
    eyebrow: "Founded 1957",
    title: "University of Waterloo",
    intro:
      "Waterloo treats co-op, engineering, computer science, math, startups, and employability like one ecosystem.",
    facts: [
      "More than 41,000 students study there annually, with the world's largest co-operative education program.",
      "Over 26,000 active co-op students connect with employers across more than 70 countries.",
      "Your resume gets upgraded every four months, while the campus wildlife still behaves like it has committee authority.",
    ],
    closer: "Waterloo is intense, inventive, and very good at turning school into real-world momentum.",
  },
  brock: {
    eyebrow: "Founded 1964",
    title: "Brock University",
    intro:
      "Brock is comprehensive but personal, with Niagara woven into its academic and campus identity.",
    facts: [
      "Just over 19,000 students study in St. Catharines, with strength in business, health, education, and grape-and-wine research.",
      "The Grape Stomp is a signature tradition, which is funny before you even remember where the campus is.",
      "Brock can be serious academically and still let purple grape juice become institutional mythology.",
    ],
    closer: "Brock has regional character in the best way: grounded, social, and hard to confuse with anywhere else.",
  },
  queens: {
    eyebrow: "Founded 1841",
    title: "Queen's University",
    intro:
      "Queen's is historic, tradition-rich, high-spirited, and deeply comfortable with its own identity.",
    facts: [
      "About 28,500 full-time students study across more than 235 academic areas in Kingston.",
      "Homecoming has a century of history, and engineering rituals like jackets and the Grease Pole are still very much alive.",
      "This is the kind of school where spirit has tenure and traditions keep getting passed down like campus lore.",
    ],
    closer: "Queen's knows exactly what it is, and honestly, that confidence is part of the charm.",
  },
  uottawa: {
    eyebrow: "Founded 1848",
    title: "University of Ottawa",
    intro:
      "uOttawa is bilingual, civically plugged-in, research-active, and built for students who like language, policy, law, and public life.",
    facts: [
      "Nearly 50,000 students study at the world's largest bilingual English-French university.",
      "Its location in Canada's capital makes public service, co-op, and professional experience feel close to the classroom.",
      "Panda Game week is fully capable of hijacking the collective attention span.",
    ],
    closer: "uOttawa can be serious in two languages and still know when rivalry season has arrived.",
  },
  mcgill: {
    eyebrow: "Founded 1821",
    title: "McGill University",
    intro:
      "McGill is prestigious, global, intellectually demanding, and unmistakably shaped by Montreal.",
    facts: [
      "It had 40,531 students in fall 2025, with nearly 30 percent international students from more than 150 countries.",
      "Its history reaches from early sports culture to Archie, an early internet search engine.",
      "Campus folklore keeps it human: Cloudberry the white squirrel somehow makes a world-famous university feel more touchable.",
    ],
    closer: "McGill is big reputation, sharp academics, and a city constantly tempting you away from the library.",
  },
};

function mobileIdentityInfo(appMode: "custom" | "university", themeId: string) {
  return appMode === "university"
    ? universityIdentityInfo[themeId] ?? universityIdentityInfo.uoft
    : markMateIdentityInfo;
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

type MobileGpaCourseListKind = "included" | "waiting";

function waitingGpaCourses(report: UniversityGpaReport) {
  return report.cumulative.excludedCourses.filter((item) =>
    /not completed|No final grade|missing or zero/i.test(item.reason)
  );
}

function gpaCourseTitle(record: UniversityGpaReport["cumulative"]["includedCourses"][number]["record"]) {
  return record.code || record.title || "Course";
}

function gpaCourseMeta(record: UniversityGpaReport["cumulative"]["includedCourses"][number]["record"]) {
  const term = record.term === "FallWinter" ? "Fall/Winter" : record.term;
  const credits =
    typeof record.creditWeight === "number" ? formatCredits(record.creditWeight) : "0";
  return `Year ${record.year} / ${term} / ${credits} credits`;
}

function gpaIncludedDisplay(
  item: UniversityGpaReport["cumulative"]["includedCourses"][number],
  report: UniversityGpaReport
) {
  const value = formatScaleValue(item.value);
  return report.policy.scaleKind === "percent"
    ? `${value}%`
    : `${value} ${report.policy.scaleLabel}`;
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
  action,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const horizontalSwipe = useHorizontalSwipeExit(onClose, open);
  const [expanded, setExpanded] = useState(false);
  const [sheetDragActive, setSheetDragActive] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const contentMeasureRef = useRef<HTMLDivElement | null>(null);
  const dragStartYRef = useRef(0);
  const collapsedOffsetRef = useRef(0);
  const expandedRef = useRef(false);
  const sheetResizeActiveRef = useRef(false);
  const sheetDragActiveRef = useRef(false);
  const [{ y }, sheetApi] = useSpring(() => ({
    y: viewportHeight(),
    config: IOS_SHEET_SPRING,
  }));
  const closeLockRef = useRef(false);

  const measureCollapsedOffset = () => {
    const fullHeight = Math.round(viewportHeight() * 0.985);
    const contentHeight =
      contentMeasureRef.current?.scrollHeight ?? fullHeight * 0.58;
    const chromeHeight = 122;
    const collapsedHeight = Math.min(
      fullHeight - 8,
      Math.max(430, Math.min(fullHeight * 0.9, contentHeight + chromeHeight))
    );
    return Math.max(0, fullHeight - collapsedHeight);
  };

  useEffect(() => {
    if (!open) return;
    closeLockRef.current = false;
    setExpanded(false);
    expandedRef.current = false;
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const nextOffset = measureCollapsedOffset();
    collapsedOffsetRef.current = nextOffset;
    sheetApi.set({ y: nextOffset });

    const onResize = () => {
      const updatedOffset = measureCollapsedOffset();
      collapsedOffsetRef.current = updatedOffset;
      sheetApi.start({
        y: expandedRef.current ? 0 : updatedOffset,
        immediate: true,
      });
    };

    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [open, sheetApi]);

  const closeFromDrag = () => {
    if (closeLockRef.current) return;
    closeLockRef.current = true;
    sheetApi.start({
      y: viewportHeight(),
      config: { tension: 620, friction: 44, mass: 0.7 },
      onRest: () => {
        onClose();
        window.setTimeout(() => {
          closeLockRef.current = false;
        }, SWIPE_LOCK_MS);
      },
    });
  };

  const setSheetDragVisual = (next: boolean) => {
    if (sheetDragActiveRef.current === next) return;
    sheetDragActiveRef.current = next;
    setSheetDragActive(next);
  };

  const settleSheet = (nextExpanded: boolean) => {
    const collapsedOffset = measureCollapsedOffset();
    collapsedOffsetRef.current = collapsedOffset;
    setExpanded(nextExpanded);
    expandedRef.current = nextExpanded;
    sheetApi.start({
      y: nextExpanded ? 0 : collapsedOffset,
      config: IOS_SHEET_SPRING,
    });
  };

  const handleDrag = useDrag(
    ({
      active,
      cancel,
      direction: [, dirY],
      event,
      first,
      last,
      movement: [mx, my],
      velocity: [, vy],
    }) => {
      if (closeLockRef.current) return;

      const fullHeight = Math.round(viewportHeight() * 0.985);
      if (first) {
        if (isSheetDragBlockingTarget(event.target)) {
          sheetResizeActiveRef.current = false;
          setSheetDragVisual(false);
          cancel();
          return;
        }
        collapsedOffsetRef.current = measureCollapsedOffset();
        dragStartYRef.current = expandedRef.current ? 0 : collapsedOffsetRef.current;
        sheetResizeActiveRef.current = false;
        setSheetDragVisual(true);
      }

      const collapsedOffset = collapsedOffsetRef.current || measureCollapsedOffset();
      const dismissOffset = viewportHeight();
      const nextY = Math.max(0, Math.min(dismissOffset, dragStartYRef.current + my));

      const absX = Math.abs(mx);
      const absY = Math.abs(my);
      const scrollParent = sheetScrollParent(event.target);
      const scrollingInsideSheet = Boolean(scrollParent && scrollParent.scrollTop > 2);
      const horizontalIntent = absX > 10 && absX > absY * 1.15;
      const wantsSheetPullDown = my > 0 && (!scrollParent || scrollParent.scrollTop <= 2);
      const wantsSheetPushUp =
        my < 0 && !expandedRef.current && (!scrollParent || scrollParent.scrollTop <= 2);
      const shouldLetContentScroll =
        Boolean(scrollParent) &&
        ((expandedRef.current && my < 0) || scrollingInsideSheet);

      if (active && !sheetResizeActiveRef.current) {
        if (horizontalIntent) {
          setSheetDragVisual(false);
          cancel();
          return;
        }

        if (absY < 6) {
          return;
        }

        if (shouldLetContentScroll || (!wantsSheetPullDown && !wantsSheetPushUp)) {
          setSheetDragVisual(false);
          return;
        }

        blurActiveMobileControl();
        pausePageSwipe();
        sheetResizeActiveRef.current = true;
      }

      if (!sheetResizeActiveRef.current) {
        if (last) {
          setSheetDragVisual(false);
        }
        return;
      }

      event.stopPropagation();
      if (event.cancelable) event.preventDefault();

      if (active) {
        setSheetDragVisual(true);
        sheetApi.start({ y: nextY, immediate: true });
        return;
      }

      setSheetDragVisual(false);

      const dismissSlack = expandedRef.current
        ? Math.min(330, fullHeight * 0.4)
        : Math.min(220, fullHeight * 0.28);
      const shouldDismiss =
        nextY > collapsedOffset + dismissSlack ||
        (!expandedRef.current &&
          dirY > 0 &&
          vy > 1.05 &&
          nextY > collapsedOffset + 74) ||
        (expandedRef.current &&
          dirY > 0 &&
          vy > 1.32 &&
          nextY > collapsedOffset + 148);
      const shouldExpand =
        nextY < collapsedOffset - Math.min(82, fullHeight * 0.12) ||
        (dirY < 0 && vy > 0.22);
      const shouldCollapse =
        expandedRef.current &&
        (nextY > Math.min(fullHeight * 0.34, collapsedOffset * 0.9) ||
          (dirY > 0 && vy > 0.52));

      if (shouldDismiss) {
        sheetResizeActiveRef.current = false;
        closeFromDrag();
        return;
      }

      if (shouldExpand && !shouldCollapse) {
        sheetResizeActiveRef.current = false;
        settleSheet(true);
        return;
      }

      sheetResizeActiveRef.current = false;
      settleSheet(false);
    },
    {
      axis: "y",
      filterTaps: true,
      eventOptions: { passive: false },
      pointer: { touch: true },
    }
  );

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
      <animated.section
        ref={sectionRef}
        className={`mobile-sheet-shell absolute inset-x-0 bottom-0 flex h-[98.5dvh] flex-col overflow-hidden rounded-t-[2rem] border border-white/70 bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4 shadow-2xl ${
          sheetDragActive ? "is-sheet-dragging" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          transform: springTo(
            [horizontalSwipe.x, y],
            (xValue, yValue) => `translate3d(${xValue}px,${yValue}px,0)`
          ),
          opacity: horizontalSwipe.opacity,
          touchAction: "pan-y",
          willChange: "transform, opacity",
        }}
        {...horizontalSwipe.bind()}
      >
        <div className="mobile-sheet-drag-surface flex min-h-0 flex-1 flex-col" {...handleDrag()}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-xl font-black tracking-tight text-slate-950">
              {title}
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              {action}
              <button
                type="button"
                className="grid min-h-11 min-w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 active:scale-[0.98]"
                data-sheet-drag-block="true"
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => {
                  event.stopPropagation();
                  onClose();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose();
                }}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5"
            data-mobile-scroll="true"
            data-no-swipe="true"
          >
            <div ref={contentMeasureRef}>{children}</div>
          </div>
        </div>
      </animated.section>
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

function MobileIdentityInfoSheet({
  open,
  onClose,
  mode,
  themeId,
  label,
}: {
  open: boolean;
  onClose: () => void;
  mode: "custom" | "university";
  themeId: string;
  label: string;
}) {
  const info = mobileIdentityInfo(mode, themeId);

  return (
    <MobileBottomSheet title={mode === "university" ? label : "MarkMate"} open={open} onClose={onClose}>
      <div className="space-y-3 pb-1">
        <section className="mobile-identity-story rounded-[1.55rem] p-4 text-white">
          <div className="flex items-start gap-3">
            <MobileSchoolMark
              themeId={mode === "university" ? themeId : "markmate"}
              label={label}
              className="ring-white/30"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/58">
                {info.eyebrow}
              </p>
              <h2 className="mt-1 text-2xl font-black leading-none tracking-tight">
                {info.title}
              </h2>
            </div>
          </div>
          <p className="mt-4 text-base font-semibold leading-relaxed text-white/78">
            {info.intro}
          </p>
        </section>

        <div className="space-y-2">
          {info.facts.map((fact, index) => (
            <article
              key={fact}
              className="mobile-identity-fact rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.45)]"
              style={{ "--fact-index": index } as React.CSSProperties}
            >
              <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-400">
                Note {index + 1}
              </p>
              <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">
                {fact}
              </p>
            </article>
          ))}
        </div>

        <p className="rounded-[1.35rem] border border-white/70 bg-slate-50 px-4 py-3 text-sm font-black leading-relaxed text-slate-700">
          {info.closer}
        </p>
      </div>
    </MobileBottomSheet>
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

function mobileEffectiveGrade(assignment: Assignment): number | null {
  if (assignment.grade == null) return null;
  const penalty = assignment.late ? assignment.latePenalty ?? 10 : 0;
  return clampPercent(assignment.grade - penalty);
}

function maxPossibleCourseGrade(course: Course) {
  const weightedAssignments = course.assignments.filter(
    (assignment) => normalizeWeightToPercent(assignment.weight) > 0
  );
  if (weightedAssignments.length === 0) return null;

  const usedWeight = weightedAssignments.reduce(
    (sum, assignment) => sum + normalizeWeightToPercent(assignment.weight),
    0
  );
  const projectedEarned = weightedAssignments.reduce((sum, assignment) => {
    const weight = normalizeWeightToPercent(assignment.weight);
    const grade = mobileEffectiveGrade(assignment);
    return sum + (weight * (grade ?? 100)) / 100;
  }, 0);
  const openWeight = Math.max(0, 100 - usedWeight);
  const denominator = usedWeight > 100 ? usedWeight : 100;

  return clampPercent(((projectedEarned + openWeight) / denominator) * 100);
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
      className="mobile-progress-orb rounded-[1rem] px-1.5 py-1.5 text-center"
      title={detail}
      style={
        {
          "--ring-color": ringColor,
          "--ring-progress": `${progress * 3.6}deg`,
        } as React.CSSProperties
      }
    >
      <div className="mx-auto grid justify-items-center gap-1">
        <div className="mobile-progress-orb-ring relative grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <span className="relative z-[1] text-[0.68rem] font-black tabular-nums text-slate-950">
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
  const maxPossible = maxPossibleCourseGrade(course);

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
      <div className="mobile-max-possible mt-2 flex min-h-10 items-center justify-between gap-3 rounded-2xl px-3 py-2">
        <span className="min-w-0">
          <span className="block text-[0.62rem] font-black uppercase tracking-wide text-white/60">
            Max possible grade you can get
          </span>
          <span className="block truncate text-[0.72rem] font-bold text-white/72">
            Remaining work at 100%
          </span>
        </span>
        <span className="shrink-0 text-lg font-black tabular-nums text-white">
          {formatPercent(maxPossible)}
        </span>
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
  onOpenCourseList,
}: {
  report: UniversityGpaReport;
  onOpenGpa: () => void;
  onOpenCourseList: (kind: MobileGpaCourseListKind) => void;
}) {
  const appMode = useCourseStore((state) => state.appMode ?? "custom");
  const completeCourses = report.cumulative.includedCourses.length;
  const waitingCount = gpaWaitingCourseCount(report);
  const primaryLabel =
    appMode === "university" ? report.policy.shortName : "MarkMate";

  return (
    <section className="relative overflow-hidden rounded-[1.65rem] border border-white/70 bg-slate-950 p-3.5 text-white shadow-[0_24px_64px_-34px_rgba(15,23,42,0.75)]">
      <div
        className="absolute inset-0 opacity-95"
        style={{
          background:
            "linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-primary) 48%, var(--theme-accent) 100%)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.26),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.12),transparent)]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/70">
              GPA estimate
            </p>
            <div className="mt-2 text-[2.7rem] font-black leading-none tracking-tight">
              {formatSchoolAverage(report)}
            </div>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-white/75">
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
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-left backdrop-blur transition active:scale-[0.98]"
            data-page-swipe-block="true"
            onClick={() => {
              triggerMobileHaptic("selection");
              onOpenCourseList("included");
            }}
          >
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-white/60">
              Included
            </p>
            <p className="mt-0.5 text-xl font-black tabular-nums">
              {completeCourses}
            </p>
          </button>
          <button
            type="button"
            className="rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-left backdrop-blur transition active:scale-[0.98]"
            data-page-swipe-block="true"
            onClick={() => {
              triggerMobileHaptic("selection");
              onOpenCourseList("waiting");
            }}
          >
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-white/60">
              Waiting
            </p>
            <p className="mt-0.5 text-xl font-black tabular-nums">
              {waitingCount}
            </p>
          </button>
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
        onClick={() => {
          triggerMobileHaptic("open");
          onAddCourse();
        }}
      >
        <Plus className="h-5 w-5" />
        Add course
      </button>
    </section>
  );
}

function EmptyCustomStructure({
  onAddYear,
}: {
  onAddYear: () => void;
}) {
  return (
    <section className="rounded-[1.6rem] border border-white/70 bg-white/95 p-4 shadow-soft backdrop-blur">
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
      <button
        type="button"
        className="mobile-glow-action mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-black active:scale-[0.98]"
        onClick={onAddYear}
      >
        <Plus className="h-5 w-5" />
        Create first year
      </button>
    </section>
  );
}

function MobileIdentityCard({
  courseCount,
  semesterCount,
  onOpenIdentity,
}: {
  courseCount: number;
  semesterCount: number;
  onOpenIdentity: () => void;
}) {
  const appMode = useCourseStore((state) => state.appMode ?? "custom");
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
              <button
                type="button"
                className="rounded-[1.15rem] text-left active:scale-[0.98]"
                onClick={() => {
                  triggerMobileHaptic("selection");
                  onOpenIdentity();
                }}
                aria-label={`About ${activeTheme.label}`}
              >
                <MobileSchoolMark
                  themeId={activeTheme.id}
                  label={activeTheme.label}
                  className="ring-white/35"
                />
              </button>
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
                    onClick={() => {
                      if (!active) triggerMobileHaptic("mode");
                      switchMobileAppMode(option.id as "custom" | "university");
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div
            className="pointer-events-none min-h-32 rounded-[1.45rem] border border-white/20 bg-cover bg-center shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
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
  recentCourses,
  folders,
  onAddCourse,
  onGoCourses,
  onGoCalendar,
  onOpenGpa,
  onOpenCourse,
  folderCount,
}: {
  report: UniversityGpaReport;
  nextAssignment?: { course: Course; assignment: Assignment };
  recentCourses: Course[];
  folders: CourseFolder[];
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
  const [widgetIndex, setWidgetIndex] = useState(0);
  const [widgetDirection, setWidgetDirection] = useState<"next" | "previous">(
    "next"
  );
  const suppressWidgetClickRef = useRef(false);
  const [{ widgetX }, widgetApi] = useSpring(() => ({
    widgetX: 0,
    config: IOS_PAGE_SPRING,
  }));
  const recentCourse = recentCourses[0];
  const recentMetrics = recentCourse ? calcMetrics(recentCourse) : null;
  const widgets = useMemo(() => {
    const nextWidget = {
      key: "next",
      label: nextAssignment ? "Next up" : "Start here",
      title:
        nextAssignment?.assignment.title ||
        (needsCustomSetup ? "Create a year" : "Add a course"),
      detail: nextAssignment
        ? `${nextAssignment.course.name} / ${formatShortDate(
            nextAssignment.assignment.dueDate
          )}`
        : needsCustomSetup
        ? "Build your own year and semester setup."
        : "Name the class, then add assignments inside it.",
      onClick: () =>
        nextAssignment
          ? onOpenCourse(nextAssignment.course.id)
          : needsCustomSetup
          ? onGoCourses()
          : onAddCourse(),
    };
    const recentWidget = recentCourse
      ? {
          key: "recent",
          label: "Recent class",
          title: recentCourse.name,
          detail: `${folderLabel(recentCourse, folders)} / ${formatPercent(
            recentMetrics?.gradeSoFar ?? 0
          )}`,
          onClick: () => onOpenCourse(recentCourse.id),
        }
      : null;
    const gpaWidget = {
      key: "gpa",
      label: "GPA status",
      title: formatSchoolAverage(report),
      detail: `${report.cumulative.includedCourses.length} included / ${gpaWaitingCourseCount(
        report
      )} waiting`,
      onClick: onOpenGpa,
    };

    return (
      nextAssignment || needsCustomSetup
        ? [nextWidget, recentWidget, gpaWidget]
        : [recentWidget, gpaWidget, nextWidget]
    ).filter(Boolean) as Array<{
        key: string;
        label: string;
        title: string;
        detail: string;
        onClick: () => void;
      }>;
  }, [
    folders,
    needsCustomSetup,
    nextAssignment,
    onAddCourse,
    onGoCourses,
    onOpenCourse,
    onOpenGpa,
    recentCourse,
    recentMetrics?.gradeSoFar,
    report,
  ]);

  const moveWidget = (direction: "next" | "previous") => {
    if (widgets.length <= 1) return;
    setWidgetDirection(direction);
    setWidgetIndex((current) =>
      direction === "next"
        ? (current + 1) % widgets.length
        : (current - 1 + widgets.length) % widgets.length
    );
  };

  useEffect(() => {
    if (widgets.length <= 1) return;
    const id = window.setInterval(() => {
      setWidgetDirection("next");
      setWidgetIndex((current) => (current + 1) % widgets.length);
    }, 3600);
    return () => window.clearInterval(id);
  }, [widgets.length]);

  const activeWidget = widgets[widgetIndex % widgets.length] ?? widgets[0];
  const widgetBind = useDrag(
    ({
      active,
      direction: [dirX],
      event,
      movement: [mx, my],
      velocity: [vx],
    }) => {
      if (widgets.length <= 1) return;
      const absX = Math.abs(mx);
      const absY = Math.abs(my);
      const horizontalIntent = absX > 6 && absX > absY * 1.08;
      if (active) {
        if (!horizontalIntent) return;
        suppressWidgetClickRef.current = true;
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
        widgetApi.start({
          widgetX: Math.max(-72, Math.min(72, mx)),
          immediate: true,
        });
        return;
      }

      const shouldMove = horizontalIntent && (absX > 28 || (absX > 18 && vx > 0.24));
      if (shouldMove) {
        moveWidget(dirX < 0 ? "next" : "previous");
        widgetApi.start({
          widgetX: dirX < 0 ? -22 : 22,
          immediate: true,
        });
      }
      widgetApi.start({ widgetX: 0, config: IOS_PAGE_SPRING });
      window.setTimeout(() => {
        suppressWidgetClickRef.current = false;
      }, 220);
    },
    {
      axis: "x",
      filterTaps: true,
      eventOptions: { passive: false },
    }
  );

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Today
          </p>
          <div className="mt-0.5 text-3xl font-black tracking-tight text-slate-950">
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

      {activeWidget && (
        <div className="mobile-smart-widget mt-3 rounded-[1.45rem] p-[1px] text-white">
          <animated.button
            key={activeWidget.key}
            type="button"
            className="mobile-smart-widget-button flex min-h-[76px] w-full items-center gap-3 rounded-[1.35rem] px-3.5 py-3 text-left"
            data-page-swipe-block="true"
            style={{
              transform: widgetX.to((value) => `translate3d(${value}px,0,0)`),
            }}
            onClick={() => {
              if (suppressWidgetClickRef.current) {
                suppressWidgetClickRef.current = false;
                return;
              }
              activeWidget.onClick();
            }}
            {...widgetBind()}
          >
            <span
              className={`mobile-widget-copy mobile-widget-copy-${widgetDirection} flex min-w-0 flex-1 items-center gap-3`}
            >
              <span className="mobile-widget-icon grid h-11 w-11 shrink-0 place-items-center rounded-2xl">
                <MarkMateLogo size="xs" className="scale-[1.08]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.68rem] font-black uppercase tracking-wide text-white/70">
                  {activeWidget.label}
                </span>
                <span className="mt-0.5 block truncate text-[1.45rem] font-black leading-none tracking-tight text-white">
                  {activeWidget.title}
                </span>
                <span className="mt-0.5 block truncate text-xs font-bold text-white/78">
                  {activeWidget.detail}
                </span>
              </span>
            </span>
          </animated.button>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="mobile-glow-action inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-base font-black active:scale-[0.98]"
          onClick={() => {
            triggerMobileHaptic(needsCustomSetup ? "selection" : "open");
            if (needsCustomSetup) onGoCourses();
            else onAddCourse();
          }}
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
  const appMode = useCourseStore((state) => state.appMode ?? "custom");
  const universityThemeId = useCourseStore(
    (state) => state.universityThemeId ?? "uoft"
  );
  const customThemeId = useCourseStore((state) => state.customThemeId ?? "classic");
  const activeTheme = getActiveTheme(appMode, universityThemeId, customThemeId);
  const report = useGpaReport();
  const [identityOpen, setIdentityOpen] = useState(false);
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
        onOpenIdentity={() => setIdentityOpen(true)}
      />
      <MobileHomeCommandPanel
        report={report}
        nextAssignment={nextAssignment}
        recentCourses={activeCourses}
        folders={folders}
        onAddCourse={onAddCourse}
        onGoCourses={onGoCourses}
        onGoCalendar={onGoCalendar}
        onOpenGpa={onOpenGpa}
        onOpenCourse={onOpenCourse}
        folderCount={folders.length}
      />

      <MobileIdentityInfoSheet
        open={identityOpen}
        onClose={() => setIdentityOpen(false)}
        mode={appMode}
        themeId={appMode === "university" ? universityThemeId : "markmate"}
        label={activeTheme.label}
      />
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
  onNestedViewChange,
  initialScopeId,
  initialYear,
}: {
  onOpenCourse: (courseId: string, context?: MobileCourseReturnContext) => void;
  onAddCourse: (folderId?: string | null) => void;
  onNestedViewChange?: (active: boolean) => void;
  initialScopeId?: string | null;
  initialYear?: string | null;
}) {
  const courses = useCourseStore((state) => state.courses);
  const folders = useCourseStore((state) => state.folders);
  const appMode = useCourseStore((state) => state.appMode ?? "custom");
  const removeFolder = useCourseStore((state) => state.removeFolder);
  const [query, setQuery] = useState("");
  const [activeYear, setActiveYear] = useState<string | null>(
    initialYear ?? null
  );
  const [activeScope, setActiveScope] = useState<string | null>(
    initialScopeId ?? null
  );
  const [semesterSheet, setSemesterSheet] = useState<CourseFolder | null>(null);
  const [createSemesterSheet, setCreateSemesterSheet] = useState<{
    mode: "year" | "semester";
    year?: string;
  } | null>(null);
  const restoreKeyRef = useRef("");
  const isCustomMode = appMode === "custom";
  const foldersById = useMemo(
    () =>
      new Map<string, CourseFolder>(
        folders.map((folder) => [folder.id, folder])
      ),
    [folders]
  );
  const sortedFolders = useMemo(() => folders.slice().sort(folderSort), [folders]);
  const customYearGroups = useMemo(
    () => groupFoldersByYear(sortedFolders),
    [sortedFolders]
  );
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

  useEffect(() => {
    const restoreKey = `${initialYear ?? ""}|${initialScopeId ?? ""}`;
    if (restoreKey === "|" || restoreKey === restoreKeyRef.current) return;
    restoreKeyRef.current = restoreKey;
    setActiveYear(initialYear ?? null);
    setActiveScope(initialScopeId ?? null);
  }, [initialScopeId, initialYear]);

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

  useEffect(() => {
    onNestedViewChange?.(Boolean(activeScopeOption || (isCustomMode && activeYear)));
    return () => onNestedViewChange?.(false);
  }, [activeScopeOption, activeYear, isCustomMode, onNestedViewChange]);

  const closeSemester = () => setActiveScope(null);
  const semesterSwipeHandlers = useHorizontalSwipeExit(closeSemester, Boolean(activeScopeOption));
  const closeYear = () => setActiveYear(null);
  const yearSwipeHandlers = useHorizontalSwipeExit(
    closeYear,
    Boolean(activeYear) && !activeScopeOption
  );
  const deleteYearAndClose = (year: string) => {
    removeCustomYear(year);
    setActiveYear(null);
  };

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
      <animated.div
        key="mobile-semester-detail"
        className="-mx-5 min-h-[calc(100dvh-8rem)] space-y-3 px-5"
        data-page-swipe-block="true"
        style={semesterSwipeHandlers.style}
        {...semesterSwipeHandlers.bind()}
      >
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
                onOpen={() =>
                  onOpenCourse(course.id, {
                    scopeId: activeScopeOption.id,
                    year: activeScopeOption.folder?.year ?? activeYear,
                  })
                }
                compact
              />
            ))}
          </div>
        )}
      </animated.div>
    );
  }

  if (isCustomMode && activeYear) {
    const yearGroup = customYearGroups.find((group) => group.year === activeYear);
    const yearFolders = yearGroup?.folders ?? [];
    const yearCourseCount = yearFolders.reduce(
      (sum, folder) => sum + coursesForScope(folder.id).length,
      0
    );

    return (
      <animated.div
        key="mobile-year-detail"
        className="-mx-5 min-h-[calc(100dvh-8rem)] space-y-2.5 px-5"
        data-page-swipe-block="true"
        style={yearSwipeHandlers.style}
        {...yearSwipeHandlers.bind()}
      >
        <section className="rounded-[1.5rem] border border-white/70 bg-white/95 p-2.5 shadow-soft backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="grid min-h-10 min-w-10 place-items-center rounded-2xl bg-slate-950 text-white active:scale-[0.98]"
              onClick={closeYear}
              aria-label="Back to years"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
                Year
              </p>
              <h1 className="mt-0.5 truncate text-lg font-black tracking-tight">
                {activeYear}
              </h1>
            </div>
            <button
              type="button"
              className="grid min-h-10 min-w-10 place-items-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-600 active:scale-[0.98]"
              onClick={() => deleteYearAndClose(activeYear)}
              aria-label={`Delete ${activeYear}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="mobile-glow-action grid min-h-10 min-w-10 place-items-center rounded-2xl active:scale-[0.98]"
              onClick={() =>
                setCreateSemesterSheet({ mode: "semester", year: activeYear })
              }
              aria-label="Add semester"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-500">
            {yearFolders.length} semesters / {yearCourseCount} courses
          </p>
        </section>

        <section className="rounded-[1.5rem] border border-white/70 bg-white/95 p-2.5 shadow-soft backdrop-blur">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
                Semesters
              </p>
              <h2 className="mt-0.5 text-base font-black tracking-tight">
                Pick one
              </h2>
            </div>
            <p className="text-xs font-black text-slate-400">
              {yearCourseCount} total
            </p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {yearFolders.map((folder) => {
              const scopedCourses = coursesForScope(folder.id);
              return (
                <div
                  key={folder.id}
                  className="mobile-accent-card relative min-h-[52px] rounded-[1rem] bg-white p-0"
                  style={
                    {
                      "--card-accent": folder.color,
                    } as React.CSSProperties
                  }
                >
                  <button
                    type="button"
                    className="block min-h-[52px] w-full rounded-[1rem] px-2.5 py-2 pr-10 text-left active:scale-[0.99]"
                    onClick={() => setActiveScope(folder.id)}
                  >
                    <span className="block truncate text-sm font-black leading-tight text-slate-950">
                      {folder.name}
                    </span>
                    <span className="mt-0.5 block text-[0.68rem] font-black text-slate-400">
                      {scopedCourses.length} courses
                    </span>
                  </button>
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 active:scale-[0.98]"
                    onClick={() => {
                      removeFolder(folder.id);
                      if (activeScope === folder.id) setActiveScope(null);
                    }}
                    aria-label={`Delete ${folder.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <MobileSemesterSheet
          open={semesterSheet != null || createSemesterSheet != null}
          onClose={() => {
            setSemesterSheet(null);
            setCreateSemesterSheet(null);
          }}
          folder={semesterSheet}
          createMode={createSemesterSheet?.mode}
          initialYear={createSemesterSheet?.year}
        />
      </animated.div>
    );
  }

  return (
    <div className="space-y-2.5">
      <section className="rounded-[1.5rem] border border-white/70 bg-white/95 p-2.5 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
              Courses
            </p>
            <h1 className="mt-0.5 text-lg font-black tracking-tight">
              Your classes
            </h1>
          </div>
        </div>
        <label className="relative mt-2 block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="min-h-10 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-3 text-sm font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
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
            className="mobile-glow-action mt-2 flex min-h-10 w-full items-center gap-3 rounded-2xl px-3 text-left active:scale-[0.99]"
            onClick={() => onAddCourse()}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-white/12">
              <Plus className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-black">New course</span>
              <span className="mt-0.5 block text-[0.68rem] font-semibold text-white/58">
                Choose semester next.
              </span>
            </span>
          </button>
        )}
      </section>

      {isCustomMode && folders.length === 0 && !query.trim() ? (
        <EmptyCustomStructure
          onAddYear={() => setCreateSemesterSheet({ mode: "year" })}
        />
      ) : courses.length === 0 && folders.length === 0 ? (
        <EmptyCourses onAddCourse={() => onAddCourse()} />
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
                onOpen={() => {
                  const folder =
                    course.folderId != null ? foldersById.get(course.folderId) ?? null : null;
                  onOpenCourse(course.id, {
                    scopeId: course.folderId ?? null,
                    year: folder?.year ?? null,
                  });
                }}
              />
            ))}
            {searchResults.length === 0 && (
              <p className="rounded-3xl border border-dashed border-slate-300 bg-white/90 px-5 py-8 text-center text-base text-slate-500">
                No courses match that search.
              </p>
            )}
          </div>
        </section>
      ) : isCustomMode ? (
        <section className="rounded-[1.5rem] border border-white/70 bg-white/95 p-2.5 shadow-soft backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
                Years
              </p>
              <h2 className="mt-0.5 text-base font-black tracking-tight">
                Your setup
              </h2>
            </div>
            <button
              type="button"
              className="mobile-glow-action grid min-h-10 min-w-10 place-items-center rounded-2xl active:scale-[0.98]"
              onClick={() => setCreateSemesterSheet({ mode: "year" })}
              aria-label="Add year"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {customYearGroups.map((group) => {
              const yearCourseCount = group.folders.reduce(
                (sum, folder) => sum + coursesForScope(folder.id).length,
                0
              );
              return (
                <div
                  key={group.year}
                  className="mobile-accent-card relative min-h-[58px] rounded-[1rem] bg-white p-0"
                  style={
                    {
                      "--card-accent":
                        group.folders[0]?.color ?? "var(--theme-primary)",
                    } as React.CSSProperties
                  }
                >
                  <button
                    type="button"
                    className="block min-h-[58px] w-full rounded-[1rem] px-2.5 py-2 pr-11 text-left active:scale-[0.99]"
                    onClick={() => setActiveYear(group.year)}
                  >
                    <span className="block truncate text-sm font-black leading-tight text-slate-950">
                      {group.year}
                    </span>
                    <span className="mt-0.5 block text-[0.68rem] font-black text-slate-400">
                      {group.folders.length} semesters / {yearCourseCount} courses
                    </span>
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 active:scale-[0.98]"
                    onClick={() => removeCustomYear(group.year)}
                    aria-label={`Delete ${group.year}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="rounded-[1.5rem] border border-white/70 bg-white/95 p-2.5 shadow-soft backdrop-blur">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
                Semesters
              </p>
              <h2 className="mt-0.5 text-base font-black tracking-tight">
                Pick one
              </h2>
            </div>
            <p className="text-xs font-black text-slate-400">
              {courses.length} total
            </p>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
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
                className="mobile-accent-card min-h-[43px] rounded-[0.95rem] bg-white px-2 py-1.5 text-left shadow-[0_14px_30px_-30px_rgba(15,23,42,0.45)] active:scale-[0.99]"
                style={
                  {
                    "--card-accent": color,
                  } as React.CSSProperties
                }
                onClick={() => setActiveScope(option.id)}
              >
                <span className="block truncate text-[0.72rem] font-black leading-tight text-slate-950">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[0.62rem] font-black text-slate-400">
                  {scopedCourses.length}
                </span>
              </button>
            );
          })}
          </div>
        </section>
      )}
      <MobileSemesterSheet
        open={semesterSheet != null || createSemesterSheet != null}
        onClose={() => {
          setSemesterSheet(null);
          setCreateSemesterSheet(null);
        }}
        folder={semesterSheet}
        createMode={createSemesterSheet?.mode}
        initialYear={createSemesterSheet?.year}
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
  onCreated: (courseId: string, folderId?: string | null) => void;
  initialFolderId?: string | null;
}) {
  const folders = useCourseStore((state) => state.folders);
  const addCourse = useCourseStore((state) => state.addCourse);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const folderSelectRef = useRef<HTMLSelectElement>(null);
  const submitLockRef = useRef(false);
  const [name, setName] = useState("");
  const [folderId, setFolderId] = useState<string | null>(
    initialFolderId ?? folders[0]?.id ?? null
  );

  useEffect(() => {
    if (!open) return;
    submitLockRef.current = false;
    setName("");
    setFolderId(initialFolderId ?? folders[0]?.id ?? null);
  }, [folders, initialFolderId, open]);

  const submit = () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    blurActiveMobileControl();
    const liveName = nameInputRef.current?.value ?? name;
    const liveFolderValue = folderSelectRef.current?.value;
    const liveFolderId =
      liveFolderValue === undefined
        ? folderId
        : liveFolderValue.trim()
        ? liveFolderValue
        : null;
    triggerMobileHaptic("success");
    const courseId = addCourse(liveName.trim() || "New Course", liveFolderId);
    onClose();
    onCreated(courseId, liveFolderId);
    window.setTimeout(() => {
      submitLockRef.current = false;
    }, 500);
  };

  const submitTouchProps = {
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (event.pointerType === "touch") event.preventDefault();
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      submit();
    },
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      submit();
    },
  };

  return (
    <MobileBottomSheet
      title="New course"
      open={open}
      onClose={onClose}
    >
      <div className="space-y-3 pb-1">
        <div className="rounded-[1.35rem] bg-slate-950 px-4 py-3 text-white">
          <p className="text-sm font-bold leading-relaxed text-white/72">
            Add it once. MarkMate opens the course next so assignments are ready.
          </p>
        </div>
        <MobileField label="Course name" hint="Examples: CIV312, COG260, APS100, CIV100">
          <input
            ref={nameInputRef}
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-semibold text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="CIV312"
            onKeyDown={blurMobileInputOnEnter}
            onBlur={settleMobileInputAfterBlur}
          />
        </MobileField>
        <div className="block text-base font-bold text-slate-700">
          <label htmlFor="mobile-course-semester">Semester</label>
          <div className="mt-2 space-y-3">
            <select
              id="mobile-course-semester"
              ref={folderSelectRef}
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
            <button
              type="button"
              className="mobile-glow-action flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-black active:scale-[0.98]"
              data-mobile-add-course-submit="true"
              {...submitTouchProps}
            >
              <Check className="h-5 w-5" />
              Add course
            </button>
          </div>
        </div>
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

  const assignmentRows = useMemo(
    () => course.assignments.slice().sort(assignmentSort),
    [course.assignments]
  );
  const selectedWeight = assignmentRows.reduce(
    (sum, assignment) =>
      selectedIds.has(assignment.id)
        ? sum + normalizeWeightToPercent(assignment.weight)
        : sum,
    0
  );

  return (
    <MobileBottomSheet title="Need to pass" open={open} onClose={onClose}>
      <div className="space-y-2.5">
        <section className="mobile-pass-summary rounded-[1.45rem] p-3 text-white">
          <div className="grid grid-cols-[1fr_5.6rem] gap-2.5">
            <div>
              <p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-white/55">
                Target
              </p>
              <p className="mt-1 text-sm font-bold leading-snug text-white/72">
                Pick the work that is still flexible.
              </p>
              <p className="mt-1 text-[0.68rem] font-black uppercase tracking-wide text-white/45">
                {selectedIds.size} selected / {formatPercent(selectedWeight)} weight
              </p>
            </div>
            <label className="block text-[0.64rem] font-black uppercase tracking-wide text-white/45">
              Final
              <input
                className="mt-1.5 min-h-11 w-full rounded-2xl border border-white/10 bg-white px-3 text-center text-lg font-black text-slate-950 outline-none focus:ring-2 focus:ring-white/25"
                inputMode="decimal"
                value={targetDraft}
                onChange={(event) => setTargetDraft(event.target.value)}
                onKeyDown={blurMobileInputOnEnter}
                onBlur={settleMobileInputAfterBlur}
                placeholder="50"
              />
            </label>
          </div>
          {weightsReady && result && (
            <div
              className={`mt-2.5 rounded-2xl px-3 py-2 text-sm font-black leading-snug ${
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
            <p className="mt-2.5 rounded-2xl bg-white/8 px-3 py-2 text-sm font-bold text-white/65">
              Select at least one assignment.
            </p>
          )}
        </section>

        {!weightsReady && (
          <p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold leading-relaxed text-amber-800">
            This calculator needs the course weights to total 100%. Right now
            they total {formatPercent(metrics.totalWeights)}.
          </p>
        )}

        <div className="rounded-[1.45rem] border border-slate-200 bg-white p-2">
          <div className="grid grid-cols-[1.45rem_minmax(5rem,1fr)_3.2rem_3.2rem] gap-1 px-1 pb-1 text-[0.58rem] font-black uppercase tracking-wide text-slate-400">
            <span />
            <span>Assignment</span>
            <span className="text-right">Weight</span>
            <span className="text-right">Grade</span>
          </div>
          <div className="max-h-[46dvh] space-y-1 overflow-y-auto overscroll-contain pr-1">
          {assignmentRows.map((assignment) => {
            const active = selectedIds.has(assignment.id);
            const effective = mobileEffectiveGrade(assignment);
            return (
              <button
                key={assignment.id}
                type="button"
                className={`grid min-h-[42px] w-full grid-cols-[1.45rem_minmax(5rem,1fr)_3.2rem_3.2rem] items-center gap-1 rounded-xl border px-1.5 py-1.5 text-left active:scale-[0.99] ${
                  active
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-100 bg-slate-50 text-slate-900"
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
                  className={`grid h-6 w-6 place-items-center rounded-full border ${
                    active
                      ? "border-white/50 bg-white/15"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black leading-tight">
                    {assignment.title}
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-[0.64rem] font-semibold ${
                      active ? "text-white/60" : "text-slate-500"
                    }`}
                  >
                    {statusLabel(assignment.status)}
                  </span>
                </span>
                <span className="text-right text-xs font-black tabular-nums">
                  {formatPercent(normalizeWeightToPercent(assignment.weight))}
                </span>
                <span className="text-right text-xs font-black tabular-nums">
                  {effective == null ? "--" : formatPercent(effective)}
                </span>
              </button>
            );
          })}
          {assignmentRows.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-5 text-center text-sm font-bold text-slate-500">
              Add assignments first, then this helper can plan the pass mark.
            </p>
          )}
          </div>
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
    <animated.div
      key="mobile-course-detail"
      className="-mx-5 min-h-[100dvh] space-y-3 px-5"
      data-page-swipe-block="true"
      style={courseSwipeHandlers.style}
      {...courseSwipeHandlers.bind()}
    >
      <header className="relative z-10 -mx-1 rounded-[1.65rem] border border-white/70 bg-white/92 p-2.5 shadow-soft backdrop-blur">
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
    </animated.div>
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
  return (
    <div className="space-y-0">
      <section
        className="rounded-[1.45rem] border border-white/70 bg-white/95 p-2.5 shadow-soft backdrop-blur"
        data-allow-page-swipe="true"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
              Calendar
            </p>
            <h1 className="mt-0.5 text-lg font-black tracking-tight">
              Deadlines
            </h1>
          </div>
          <button
            type="button"
            className="grid min-h-10 min-w-10 place-items-center rounded-2xl bg-slate-950 text-white shadow-soft active:scale-[0.98]"
            onClick={() => setQuickOpen(true)}
            aria-label="Add deadline"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            className="grid min-h-9 min-w-9 place-items-center rounded-xl bg-white text-slate-700 shadow-soft active:scale-[0.98]"
            onClick={() =>
              setActiveMonth(
                new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1)
              )
            }
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-black text-slate-950">
            {monthTitle(activeMonth)}
          </p>
          <button
            type="button"
            className="grid min-h-9 min-w-9 place-items-center rounded-xl bg-white text-slate-700 shadow-soft active:scale-[0.98]"
            onClick={() =>
              setActiveMonth(
                new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1)
              )
            }
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {calendarScopes.length > 2 && (
          <div className="-mx-0.5 mt-1.5 flex gap-1.5 overflow-x-auto px-0.5 pb-1">
            {calendarScopes.map((scope) => {
              const active = filter === scope.id;
              return (
                <button
                  key={scope.id}
                  type="button"
                  className={`min-h-8 max-w-[7rem] shrink-0 truncate rounded-2xl px-2.5 text-[0.7rem] font-black ${
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
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[0.64rem] font-black uppercase tracking-wide text-slate-400">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <div key={`${day}-${index}`} className="py-0.5">
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
                className={`relative grid h-8 min-h-0 place-items-center rounded-xl text-xs font-black transition active:scale-[0.96] ${
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

        <div className="mt-2 rounded-[1.2rem] bg-slate-950 p-2.5 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-black uppercase tracking-wide text-white/45">
                Agenda
              </p>
              <h2 className="mt-0.5 truncate text-sm font-black">
                {formatLongDate(selectedDate)}
              </h2>
            </div>
            <button
              type="button"
              className="grid min-h-9 min-w-9 place-items-center rounded-xl bg-white text-slate-950 active:scale-[0.98]"
              onClick={() => setQuickOpen(true)}
              aria-label="Add deadline"
            >
              <Plus className="h-4 w-4" />
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
                className="min-h-10 w-full rounded-2xl border border-white/12 bg-white/8 px-3 text-left text-xs font-black text-white/72 active:scale-[0.99]"
                onClick={() => setQuickOpen(true)}
              >
                No deadlines. Tap to add one.
              </button>
            )}
          </div>
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
  const rows = [...yearRows, ...sessionRows];
  const [courseListOpen, setCourseListOpen] =
    useState<MobileGpaCourseListKind | null>(null);

  return (
    <div className="space-y-2.5">
      <MobileGpaHero
        report={report}
        onOpenGpa={onOpenGpa}
        onOpenCourseList={setCourseListOpen}
      />
      <section className="rounded-[1.65rem] border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
              Breakdown
            </p>
            <h1 className="mt-0.5 text-xl font-black tracking-tight">
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
        <div className="mt-3 divide-y divide-slate-100">
          {rows.map((row) => (
            <div
              key={`${row.label}-${"id" in row ? row.id : row.key}`}
              className="flex min-h-[52px] items-center justify-between gap-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">
                  {row.label}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  {averageDetail(row.result)}
                </p>
              </div>
              <p className="text-base font-black tabular-nums text-slate-950">
                {row.result.displayAverage == null
                  ? "--"
                  : formatAverage(row.result)}
              </p>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm font-semibold text-slate-500">
              Complete a course to unlock year and session breakdowns.
            </p>
          )}
        </div>
      </section>
      <MobileGpaCourseListSheet
        open={courseListOpen != null}
        kind={courseListOpen ?? "included"}
        report={report}
        onClose={() => setCourseListOpen(null)}
      />
    </div>
  );
}

function MobileGpaCourseListSheet({
  open,
  kind,
  report,
  onClose,
}: {
  open: boolean;
  kind: MobileGpaCourseListKind;
  report: UniversityGpaReport;
  onClose: () => void;
}) {
  const included = report.cumulative.includedCourses;
  const waiting = waitingGpaCourses(report);
  const isIncluded = kind === "included";
  const count = isIncluded ? included.length : waiting.length;

  return (
    <MobileBottomSheet
      title={isIncluded ? "Included courses" : "Waiting courses"}
      open={open}
      onClose={onClose}
    >
      <div className="space-y-3 pb-1">
        <section className="mobile-gpa-list-summary rounded-[1.45rem] p-4 text-white">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/58">
            GPA estimate
          </p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <h2 className="text-3xl font-black leading-none tracking-tight">
              {count}
            </h2>
            <p className="pb-1 text-sm font-black text-white/70">
              {isIncluded ? "counting now" : "waiting on final data"}
            </p>
          </div>
        </section>

        <div className="space-y-2">
          {isIncluded
            ? included.map((item) => (
                <article
                  key={item.record.id}
                  className="mobile-gpa-course-row rounded-[1.25rem] border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-slate-950">
                        {gpaCourseTitle(item.record)}
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-slate-500">
                        {gpaCourseMeta(item.record)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-2xl bg-emerald-50 px-3 py-1 text-sm font-black tabular-nums text-emerald-700">
                      {gpaIncludedDisplay(item, report)}
                    </span>
                  </div>
                  {item.warning && (
                    <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                      {item.warning}
                    </p>
                  )}
                </article>
              ))
            : waiting.map((item) => (
                <article
                  key={item.record.id}
                  className="mobile-gpa-course-row rounded-[1.25rem] border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-slate-950">
                        {gpaCourseTitle(item.record)}
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-slate-500">
                        {gpaCourseMeta(item.record)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-2xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                      Pending
                    </span>
                  </div>
                  <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                    {item.reason}
                  </p>
                </article>
              ))}
        </div>

        {count === 0 && (
          <p className="rounded-[1.25rem] border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm font-bold text-slate-500">
            {isIncluded
              ? "No completed GPA courses are included yet."
              : "Nothing is waiting right now."}
          </p>
        )}
      </div>
    </MobileBottomSheet>
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
  createMode = "semester",
  initialYear,
}: {
  open: boolean;
  onClose: () => void;
  folder: CourseFolder | null;
  createMode?: "year" | "semester";
  initialYear?: string;
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
    setName(folder?.name ?? (createMode === "year" ? "Fall" : ""));
    setYear(
      folder?.year ??
        initialYear ??
        (createMode === "year" ? nextCustomYearName(folders) : semesterYears[0])
    );
    setColor(folder?.color ?? semesterColors[folders.length % semesterColors.length]);
    setError("");
  }, [createMode, folder, folders, folders.length, initialYear, open]);

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
      title={folder ? "Edit semester" : createMode === "year" ? "New year" : "New semester"}
      open={open}
      onClose={onClose}
    >
      <div className="space-y-4">
        <MobileField
          label="Year"
          hint={
            createMode === "year"
              ? "Make any container: Year 1, Grade 12, Bootcamp."
              : "This semester will live inside this year."
          }
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
        <MobileField
          label={createMode === "year" ? "First semester" : "Semester"}
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
          {folder ? "Save semester" : createMode === "year" ? "Create year" : "Add semester"}
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

function MobileInstallGuideCarousel() {
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const userControlUntilRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const scrollToSlide = (
    index: number,
    behavior: ScrollBehavior = "smooth",
    userControlled = true
  ) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const nextIndex =
      (index + installGuideSlides.length) % installGuideSlides.length;
    if (userControlled) userControlUntilRef.current = Date.now() + 5200;
    scroller.scrollTo({
      left: scroller.clientWidth * nextIndex,
      behavior,
    });
    setActiveSlide(nextIndex);
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      if (Date.now() < userControlUntilRef.current) return;
      scrollToSlide(activeSlide + 1, "smooth", false);
    }, 4300);
    return () => window.clearInterval(id);
  }, [activeSlide]);

  useEffect(() => {
    return () => {
      if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const onScroll = () => {
    if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const nextIndex = Math.round(scroller.scrollLeft / scroller.clientWidth);
      setActiveSlide(
        Math.max(0, Math.min(installGuideSlides.length - 1, nextIndex))
      );
    });
  };

  return (
    <div
      className="mobile-install-guide mt-3 rounded-[1.45rem] p-[1px]"
      data-page-swipe-block="true"
    >
      <div className="relative overflow-hidden rounded-[1.38rem] bg-white/90 p-2">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-slate-400">
              iPhone install
            </p>
            <p className="text-sm font-black text-slate-900">
              Swipe the guide or let it play.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-500">
            {activeSlide + 1}/{installGuideSlides.length}
          </span>
        </div>

        <div
          ref={scrollerRef}
          className="mobile-install-guide-rail"
          onScroll={onScroll}
          onPointerDown={() => {
            userControlUntilRef.current = Date.now() + 6200;
          }}
        >
          {installGuideSlides.map((slide) => (
            <figure key={slide.src} className="mobile-install-guide-slide">
              <img src={slide.src} alt={slide.alt} loading="lazy" draggable={false} />
            </figure>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 active:scale-[0.98]"
            onClick={() => scrollToSlide(activeSlide - 1)}
            aria-label="Previous install step"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center gap-1.5">
            {installGuideSlides.map((slide, index) => (
              <button
                key={slide.src}
                type="button"
                className={`h-2 rounded-full transition-all ${
                  index === activeSlide
                    ? "w-6 bg-slate-950"
                    : "w-2 bg-slate-300"
                }`}
                onClick={() => scrollToSlide(index)}
                aria-label={`Go to install step ${index + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 active:scale-[0.98]"
            onClick={() => scrollToSlide(activeSlide + 1)}
            aria-label="Next install step"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

type MobileCelebrationKind = "course" | "folder" | "year" | "all";

function mobileCourseIsComplete(course: Course) {
  return (
    course.assignments.length > 0 && calcMetrics(course).displayCompleted >= 100
  );
}

async function fireMobileCompletionBurst(kind: MobileCelebrationKind) {
  try {
    const { default: confetti } = await import("canvas-confetti");
    const big = kind === "year" || kind === "all";
    confetti({
      particleCount: kind === "all" ? 220 : big ? 170 : 115,
      spread: kind === "course" ? 74 : 104,
      startVelocity: big ? 54 : 42,
      origin: { x: 0.5, y: 0.32 },
      scalar: big ? 1.08 : 0.95,
      colors: ["#37aee2", "#30b987", "#d7a43a", "#f472b6", "#0f172a"],
    });
    if (big) {
      window.setTimeout(() => {
        confetti({
          particleCount: 90,
          spread: 118,
          startVelocity: 32,
          origin: { x: 0.5, y: 0.08 },
          colors: ["#7dd3fc", "#86efac", "#fde68a", "#fda4af"],
        });
      }, 240);
    }
  } catch {
    // Offline or reduced environments can skip confetti without breaking progress.
  }
}

function MobileCelebrationCenter() {
  const courses = useCourseStore((state) => state.courses);
  const folders = useCourseStore((state) => state.folders);
  const [toast, setToast] = useState<{
    kind: MobileCelebrationKind;
    title: string;
    detail: string;
  } | null>(null);
  const previous = useRef({
    courses: new Set<string>(),
    folders: new Set<string>(),
    years: new Set<string>(),
    all: false,
    initialized: false,
  });

  useEffect(() => {
    const completeCourses = new Set(
      courses.filter(mobileCourseIsComplete).map((course) => course.id)
    );
    const coursesByFolder = new Map<string, Course[]>();
    courses.forEach((course) => {
      if (!course.folderId) return;
      coursesByFolder.set(course.folderId, [
        ...(coursesByFolder.get(course.folderId) ?? []),
        course,
      ]);
    });
    const completeFolders = new Set(
      folders
        .filter((folder) => {
          const folderCourses = coursesByFolder.get(folder.id) ?? [];
          return (
            folderCourses.length > 0 &&
            folderCourses.every(mobileCourseIsComplete)
          );
        })
        .map((folder) => folder.id)
    );
    const yearGroups = groupFoldersByYear(folders);
    const completeYears = new Set(
      yearGroups
        .filter((group) => {
          const yearCourses = group.folders.flatMap(
            (folder) => coursesByFolder.get(folder.id) ?? []
          );
          return (
            yearCourses.length > 0 &&
            yearCourses.every(mobileCourseIsComplete)
          );
        })
        .map((group) => group.year)
    );
    const allComplete =
      courses.length > 0 && courses.every(mobileCourseIsComplete);

    if (!previous.current.initialized) {
      previous.current = {
        courses: completeCourses,
        folders: completeFolders,
        years: completeYears,
        all: allComplete,
        initialized: true,
      };
      return;
    }

    const events: Array<{
      kind: MobileCelebrationKind;
      title: string;
      detail: string;
    }> = [];
    const newlyCompletedCourse = courses.find(
      (course) =>
        completeCourses.has(course.id) &&
        !previous.current.courses.has(course.id)
    );
    const newlyCompletedFolder = folders.find(
      (folder) =>
        completeFolders.has(folder.id) &&
        !previous.current.folders.has(folder.id)
    );
    const newlyCompletedYear = yearGroups.find(
      (group) =>
        completeYears.has(group.year) && !previous.current.years.has(group.year)
    );

    if (newlyCompletedCourse) {
      events.push({
        kind: "course",
        title: `${newlyCompletedCourse.name} finished`,
        detail: "Course complete. That progress deserves a moment.",
      });
    }
    if (newlyCompletedFolder) {
      events.push({
        kind: "folder",
        title: `${folderDisplayName(newlyCompletedFolder)} finished`,
        detail: "Semester cleared. Keep that momentum.",
      });
    }
    if (newlyCompletedYear) {
      events.push({
        kind: "year",
        title: `${newlyCompletedYear.year} finished`,
        detail: "Year wrapped. MarkMate is calling that a clean win.",
      });
    }
    if (allComplete && !previous.current.all) {
      events.push({
        kind: "all",
        title: "Everything is complete",
        detail: "Full setup cleared. That is the good kind of ridiculous.",
      });
    }

    const timers = events.map((event, index) =>
      window.setTimeout(() => {
        void fireMobileCompletionBurst(event.kind);
        setToast(event);
      }, index * 1150)
    );

    previous.current = {
      courses: completeCourses,
      folders: completeFolders,
      years: completeYears,
      all: allComplete,
      initialized: true,
    };

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [courses, folders]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  const Icon =
    toast.kind === "all"
      ? Trophy
      : toast.kind === "year"
      ? Medal
      : toast.kind === "folder"
      ? PartyPopper
      : CheckCircle2;

  return (
    <div className={`celebration-toast celebration-${toast.kind}`}>
      <div className="celebration-toast-icon">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-black">{toast.title}</div>
        <div className="text-sm font-semibold opacity-85">{toast.detail}</div>
      </div>
      <button
        type="button"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/12 active:scale-[0.98]"
        onClick={() => setToast(null)}
        aria-label="Dismiss celebration"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function MobileSettings() {
  const appMode = useCourseStore((state) => state.appMode ?? "custom");
  const universityThemeId = useCourseStore(
    (state) => state.universityThemeId ?? "uoft"
  );
  const setUniversityTheme = useCourseStore((state) => state.setUniversityTheme);
  const customThemeId = useCourseStore((state) => state.customThemeId ?? "classic");
  const setCustomTheme = useCourseStore((state) => state.setCustomTheme);
  const folders = useCourseStore((state) => state.folders);
  const removeFolder = useCourseStore((state) => state.removeFolder);
  const [semesterSheet, setSemesterSheet] = useState<CourseFolder | null>(null);
  const [createSemesterSheet, setCreateSemesterSheet] = useState<{
    mode: "year" | "semester";
    year?: string;
  } | null>(null);
  const customYearGroups = useMemo(() => groupFoldersByYear(folders), [folders]);
  const standalone = useStandalonePwa();
  const likelyIOS = useMemo(() => isLikelyIOSDevice(), []);
  const deleteYear = (year: string) => {
    removeCustomYear(year);
    setSemesterSheet(null);
    setCreateSemesterSheet(null);
  };

  return (
    <div className="space-y-3">
      <section className="rounded-[1.55rem] border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
          Settings
        </p>
        <h1 className="mt-0.5 text-xl font-black tracking-tight">
          School and setup
        </h1>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
          {[
            { id: "custom", label: "Custom" },
            { id: "university", label: "University" },
          ].map((option) => {
            const active = appMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={`min-h-10 rounded-xl text-sm font-black ${
                  active ? "bg-white text-slate-950 shadow-soft" : "text-slate-500"
                }`}
                onClick={() => {
                  if (!active) triggerMobileHaptic("mode");
                  switchMobileAppMode(option.id as "custom" | "university");
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.55rem] border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
              iPhone app mode
            </p>
            <h2 className="mt-0.5 text-lg font-black tracking-tight">
              {standalone ? "Installed on this device" : "Add to Home Screen"}
            </h2>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
              {standalone
                ? "MarkMate is running in standalone mode with the browser chrome tucked away."
                : likelyIOS
                ? "Install MarkMate from Safari to open it like an app, without the Safari address bar."
                : "Install MarkMate from your browser menu for a home-screen app shortcut."}
            </p>
          </div>
        </div>
        {standalone ? (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            App mode is active
          </div>
        ) : (
          <MobileInstallGuideCarousel />
        )}
      </section>

      {appMode === "university" ? (
        <>
          <section className="rounded-[1.55rem] border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
            <div className="mb-3 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-slate-400" />
              <h2 className="text-lg font-black tracking-tight">University</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {universityOptions.map((option) => {
                const active = universityThemeId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`min-h-11 rounded-2xl border px-3 text-sm font-black ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                    onClick={() => {
                      if (!active) triggerMobileHaptic("selection");
                      setUniversityTheme(option.id);
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="rounded-[1.55rem] border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
            <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
              Semesters
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="rounded-2xl border border-slate-200 bg-white px-2 py-2"
                >
                  <p className="text-[0.62rem] font-black text-slate-400">
                    {folder.year}
                  </p>
                  <p className="mt-0.5 text-xs font-black text-slate-800">
                    {folder.name}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="rounded-[1.55rem] border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-slate-400" />
              <h2 className="text-lg font-black tracking-tight">Slates</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {customThemeOptions.map((option) => {
                const active = customThemeId === option.id;
                const preview = customSlatePreview(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`min-h-[4rem] rounded-2xl border p-2.5 text-left active:scale-[0.99] ${
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
                    <span className="mt-1.5 block text-xs font-black leading-tight">
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
          <section className="rounded-[1.55rem] border border-white/70 bg-white/95 p-3 shadow-soft backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
                  Structure
                </p>
                <h2 className="text-lg font-black tracking-tight">
                  Years and semesters
                </h2>
              </div>
              <button
                type="button"
                className="grid min-h-10 min-w-10 place-items-center rounded-2xl bg-slate-950 text-white active:scale-[0.98]"
                onClick={() => setCreateSemesterSheet({ mode: "year" })}
                aria-label="Add year"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {customYearGroups.map((group) => (
                <div
                  key={group.year}
                  className="mobile-accent-card rounded-[1.25rem] bg-white p-2.5"
                  style={
                    {
                      "--card-accent":
                        group.folders[0]?.color ?? "var(--theme-primary)",
                    } as React.CSSProperties
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-slate-950">
                        {group.year}
                      </p>
                      <p className="text-xs font-bold text-slate-400">
                        {group.folders.length} semesters
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        className="grid min-h-10 min-w-10 place-items-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-600 active:scale-[0.98]"
                        onClick={() => deleteYear(group.year)}
                        aria-label={`Delete ${group.year}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="grid min-h-10 min-w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 active:scale-[0.98]"
                        onClick={() =>
                          setCreateSemesterSheet({
                            mode: "semester",
                            year: group.year,
                          })
                        }
                        aria-label={`Add semester to ${group.year}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {group.folders.map((folder) => (
                      <div
                        key={folder.id}
                        className="mobile-accent-card relative min-h-[44px] rounded-2xl bg-slate-50 p-0"
                        style={
                          {
                            "--card-accent": folder.color,
                          } as React.CSSProperties
                        }
                      >
                        <button
                          type="button"
                          className="flex min-h-[44px] w-full items-center gap-2 rounded-2xl px-2.5 py-1.5 pr-10 text-left active:scale-[0.99]"
                          onClick={() => setSemesterSheet(folder)}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-slate-950">
                              {folder.name}
                            </span>
                            <span className="block text-[0.65rem] font-bold text-slate-400">
                              Edit
                            </span>
                          </span>
                          <Edit3 className="h-3.5 w-3.5 text-slate-400" />
                        </button>
                        <button
                          type="button"
                          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 active:scale-[0.98]"
                          onClick={() => {
                            removeFolder(folder.id);
                            if (semesterSheet?.id === folder.id) setSemesterSheet(null);
                          }}
                          aria-label={`Delete ${folder.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
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
        open={semesterSheet != null || createSemesterSheet != null}
        onClose={() => {
          setSemesterSheet(null);
          setCreateSemesterSheet(null);
        }}
        folder={semesterSheet}
        createMode={createSemesterSheet?.mode}
        initialYear={createSemesterSheet?.year}
      />
    </div>
  );
}

export default function MobileApp() {
  const [activeTab, setActiveTab] = useState<MobileTab>("dashboard");
  const [gpaOpen, setGpaOpen] = useState(false);
  const [headerIdentityOpen, setHeaderIdentityOpen] = useState(false);
  const [courseCreateOpen, setCourseCreateOpen] = useState(false);
  const [courseCreateFolderId, setCourseCreateFolderId] = useState<string | null>(
    null
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [coursesNestedOpen, setCoursesNestedOpen] = useState(false);
  const [courseReturnContext, setCourseReturnContext] =
    useState<MobileCourseReturnContext | null>(null);
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
  const keyboardOpen = useMobileKeyboardOpen();

  const showCourseDetail = activeTab === "courses" && selectedCourseId;

  const courseContextFromId = (
    courseId: string,
    explicitContext?: MobileCourseReturnContext
  ): MobileCourseReturnContext | null => {
    if (explicitContext !== undefined) return explicitContext;
    const course = useCourseStore.getState().courses.find((item) => item.id === courseId);
    if (!course) return null;
    const folder =
      course.folderId != null
        ? useCourseStore.getState().folders.find((item) => item.id === course.folderId) ?? null
        : null;
    return {
      scopeId: course.folderId ?? "unfiled",
      year: folder?.year ?? null,
    };
  };

  const openCourse = (courseId: string, context?: MobileCourseReturnContext) => {
    setActiveTab("courses");
    setCourseReturnContext(courseContextFromId(courseId, context));
    setSelectedCourseId(courseId);
  };

  const openCourseCreate = (folderId?: string | null) => {
    setCourseCreateFolderId(folderId ?? null);
    setCourseCreateOpen(true);
  };
  const goToTab = (tab: MobileTab) => {
    setSelectedCourseId(null);
    setCourseReturnContext(null);
    setCoursesNestedOpen(false);
    setActiveTab(tab);
  };
  const goToNextTab = () => {
    setSelectedCourseId(null);
    setCourseReturnContext(null);
    setCoursesNestedOpen(false);
    setActiveTab((current) => {
      const index = mobileTabs.findIndex((tab) => tab.id === current);
      if (index < 0 || index >= mobileTabs.length - 1) return current;
      return mobileTabs[index + 1].id;
    });
  };
  const goToPreviousTab = () => {
    setSelectedCourseId(null);
    setCourseReturnContext(null);
    setCoursesNestedOpen(false);
    setActiveTab((current) => {
      const index = mobileTabs.findIndex((tab) => tab.id === current);
      if (index <= 0) return current;
      return mobileTabs[index - 1].id;
    });
  };
  const activeTabIndex = Math.max(
    0,
    mobileTabs.findIndex((tab) => tab.id === activeTab)
  );
  const tabSwipeHandlers = useHorizontalSwipeNavigation(
    activeTabIndex,
    mobileTabs.length,
    goToNextTab,
    goToPreviousTab,
    !showCourseDetail &&
      !courseCreateOpen &&
      !gpaOpen &&
      !(activeTab === "courses" && coursesNestedOpen)
  );
  const previousTab = !showCourseDetail
    ? mobileTabs[activeTabIndex - 1]?.id ?? null
    : null;
  const nextTab = !showCourseDetail
    ? mobileTabs[activeTabIndex + 1]?.id ?? null
    : null;

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
    if (
      appMode === "custom" &&
      useCourseStore.getState().courses.length === 0 &&
      isUniversityLikeFolderSet(folders)
    ) {
      useCourseStore.setState({ folders: [] });
    }
  }, [appMode, folders]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [activeTab, selectedCourseId]);

  const renderTabContent = (tab: MobileTab, preview = false) => {
    if (showCourseDetail && !preview) {
      return (
        <MobileCourseDetail
          courseId={selectedCourseId}
          onBack={() => setSelectedCourseId(null)}
        />
      );
    }

    if (tab === "dashboard") {
      return (
        <MobileDashboard
          onOpenGpa={preview ? () => {} : () => setGpaOpen(true)}
          onOpenCourse={preview ? () => {} : openCourse}
          onAddCourse={
            preview
              ? () => {}
              : () => openCourseCreate()
          }
          onGoCalendar={
            preview
              ? () => {}
              : () => {
                  setSelectedCourseId(null);
                  setCourseReturnContext(null);
                  setCoursesNestedOpen(false);
                  setActiveTab("calendar");
                }
          }
          onGoCourses={
            preview
              ? () => {}
              : () => {
                  setSelectedCourseId(null);
                  setCourseReturnContext(null);
                  setCoursesNestedOpen(false);
                  setActiveTab("courses");
                }
          }
        />
      );
    }

    if (tab === "courses") {
      return (
        <MobileCourses
          onOpenCourse={preview ? () => {} : openCourse}
          onAddCourse={preview ? () => {} : openCourseCreate}
          onNestedViewChange={preview ? undefined : setCoursesNestedOpen}
          initialScopeId={preview ? null : courseReturnContext?.scopeId ?? null}
          initialYear={preview ? null : courseReturnContext?.year ?? null}
        />
      );
    }

    if (tab === "calendar") {
      return <MobileCalendar onOpenCourse={preview ? () => {} : openCourse} />;
    }

    if (tab === "gpa") {
      return <MobileGpa onOpenGpa={preview ? () => {} : () => setGpaOpen(true)} />;
    }

    return <MobileSettings />;
  };

  const renderTabHeader = (tab: MobileTab) => {
    const label = mobileTabs.find((item) => item.id === tab)?.label ?? "MarkMate";
    return (
      <header className="sticky top-0 z-20 -mx-5 mb-4 border-b border-white/70 bg-white/86 px-5 pb-3 pt-[calc(env(safe-area-inset-top)+0.6rem)] shadow-[0_16px_42px_-34px_rgba(15,23,42,0.5)] backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-[1.25rem] text-left active:scale-[0.98]"
            onClick={() => {
              triggerMobileHaptic("selection");
              setHeaderIdentityOpen(true);
            }}
            aria-label={`About ${activeTheme.label}`}
          >
            <MobileSchoolMark
              themeId={appMode === "university" ? activeTheme.id : "markmate"}
              label={activeTheme.label}
            />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              {activeTheme.label}
            </p>
            <h1 className="truncate text-xl font-black tracking-tight">
              {label}
            </h1>
          </div>
        </div>
      </header>
    );
  };

  const renderTabFrame = (tab: MobileTab, preview = false) => (
    <>
      {!showCourseDetail && renderTabHeader(tab)}
      {renderTabContent(tab, preview)}
    </>
  );

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
      <animated.main
        className={`relative mx-auto min-h-[100dvh] w-full max-w-md overflow-x-hidden px-5 ${
          showCourseDetail ? "pt-[calc(env(safe-area-inset-top)+0.6rem)]" : "pt-0"
        } ${
          keyboardOpen ? "pb-8" : "pb-[calc(env(safe-area-inset-bottom)+7rem)]"
        }`}
        style={{ touchAction: "pan-y" }}
        {...tabSwipeHandlers.bind()}
      >
        <div className="relative">
          <animated.div style={tabSwipeHandlers.style}>
            {renderTabFrame(activeTab)}
          </animated.div>
          {previousTab && (
            <animated.div
              className="pointer-events-none absolute inset-x-0 top-0"
              aria-hidden="true"
              style={tabSwipeHandlers.previousStyle}
            >
              {renderTabFrame(previousTab, true)}
            </animated.div>
          )}
          {nextTab && (
            <animated.div
              className="pointer-events-none absolute inset-x-0 top-0"
              aria-hidden="true"
              style={tabSwipeHandlers.nextStyle}
            >
              {renderTabFrame(nextTab, true)}
            </animated.div>
          )}
        </div>
      </animated.main>

      {!showCourseDetail && !keyboardOpen && (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-white/70 bg-white/90 px-3 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] pt-2.5 shadow-[0_-18px_44px_-28px_rgba(15,23,42,0.45)] backdrop-blur"
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
      <MobileIdentityInfoSheet
        open={headerIdentityOpen}
        onClose={() => setHeaderIdentityOpen(false)}
        mode={appMode}
        themeId={appMode === "university" ? universityThemeId : "markmate"}
        label={activeTheme.label}
      />
      <MobileCourseCreateSheet
        open={courseCreateOpen}
        onClose={() => {
          setCourseCreateOpen(false);
          setCourseCreateFolderId(null);
        }}
        onCreated={(courseId, createdFolderId) => {
          const folder =
            createdFolderId != null
              ? folders.find((item) => item.id === createdFolderId) ?? null
              : null;
          openCourse(courseId, {
            scopeId: createdFolderId ?? "unfiled",
            year: folder?.year ?? null,
          });
        }}
        initialFolderId={courseCreateFolderId}
      />
      <MobileCelebrationCenter />
    </div>
  );
}
