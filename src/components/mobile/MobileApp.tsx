import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  GPA_POLICY_EXPLANATIONS,
  averageDetail,
  buildCourseGradeRecords,
  calcMetrics,
  formatCredits,
  formatSchoolAverage,
  getActiveTheme,
  gpaSessionRows,
  gpaWaitingCourseCount,
  gpaYearRows,
  selectedUniversityId,
  useCourseStore,
  type Assignment,
  type AssignmentStatus,
  type Course,
  type CourseFolder,
} from "../desktop/DesktopApp";
import {
  calculateUniversityReport,
  formatAverage,
  type GradeMode,
  type UniversityGpaReport,
} from "../../lib/gpa";

type MobileTab = "dashboard" | "courses" | "gpa" | "settings";

const mobileTabs: Array<{
  id: MobileTab;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "courses", label: "Courses", icon: BookOpen },
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
  return folder.year ? `${folder.year} ${folder.name}` : folder.name;
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${Number(value.toFixed(1)).toString()}%`;
}

function assignmentDueLabel(assignment: Assignment) {
  if (!assignment.dueDate) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${assignment.dueDate}T00:00:00`));
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
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-950/35"
      role="presentation"
      style={{ position: "fixed", zIndex: 40 }}
    >
      <button
        type="button"
        className="absolute inset-0 h-full w-full"
        aria-label="Close sheet"
        onClick={onClose}
      />
      <section
        className="absolute inset-x-0 bottom-0 max-h-[94dvh] overflow-y-auto rounded-t-[2rem] border border-white/70 bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
    </div>
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
    <article className="rounded-3xl border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-3 text-4xl font-black tabular-nums tracking-tight text-slate-950">
        {value}
      </div>
      <p className="mt-2 text-base leading-snug text-slate-500">{detail}</p>
    </article>
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.28),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.12),transparent)]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">
              GPA estimate
            </p>
            <div className="mt-4 text-[3.5rem] font-black leading-none tracking-tight">
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
        <div className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-white/60">
              Included
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums">
              {completeCourses}
            </p>
          </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
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
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-white">
        <BookOpen className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-2xl font-black tracking-tight">
        Add your first course.
      </h2>
      <p className="mx-auto mt-2 max-w-xs text-base leading-relaxed text-slate-500">
        Start with one class and MarkMate will keep the phone view calm.
      </p>
      <button
        type="button"
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-base font-bold text-white shadow-soft active:scale-[0.98]"
        onClick={onAddCourse}
      >
        <Plus className="h-5 w-5" />
        Add course
      </button>
    </section>
  );
}

function MobileDashboard({
  onOpenGpa,
  onGoCourses,
}: {
  onOpenGpa: () => void;
  onGoCourses: () => void;
}) {
  const courses = useCourseStore((state) => state.courses);
  const folders = useCourseStore((state) => state.folders);
  const appMode = useCourseStore((state) => state.appMode ?? "custom");
  const addCourse = useCourseStore((state) => state.addCourse);
  const report = useGpaReport();
  const defaultFolderId = folders[0]?.id ?? null;
  const nextAssignment = useMemo(() => {
    return courses
      .flatMap((course) =>
        course.assignments
          .filter((assignment) => assignment.status !== "completed")
          .map((assignment) => ({ course, assignment }))
      )
      .sort((a, b) =>
        (a.assignment.dueDate ?? "9999-12-31").localeCompare(
          b.assignment.dueDate ?? "9999-12-31"
        )
      )[0];
  }, [courses]);
  const activeCourses = courses.slice(0, 3);

  return (
    <div className="space-y-5">
      <MobileGpaHero report={report} onOpenGpa={onOpenGpa} />

      <div className="grid grid-cols-2 gap-3">
        <MobileMetric
          label="Courses"
          value={String(courses.length)}
          detail={`${folders.length} semesters`}
        />
        <MobileMetric
          label="Mode"
          value={appMode === "university" ? "Uni" : "Custom"}
          detail={appMode === "university" ? "School rules on" : "Flexible setup"}
        />
      </div>

      {courses.length === 0 ? (
        <EmptyCourses onAddCourse={() => addCourse("New Course", defaultFolderId)} />
      ) : (
        <>
          <section className="rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Next up
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">
                  {nextAssignment?.assignment.title || "No urgent tasks"}
                </h2>
              </div>
              <CalendarDays className="h-6 w-6 text-slate-400" />
            </div>
            <p className="mt-3 text-base leading-relaxed text-slate-500">
              {nextAssignment
                ? `${nextAssignment.course.name} · ${assignmentDueLabel(
                    nextAssignment.assignment
                  )}`
                : "You are clear for now. Add upcoming work from a course screen."}
            </p>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Courses
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">
                  Keep moving.
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
            <div className="space-y-3">
              {activeCourses.map((course) => {
                const metrics = calcMetrics(course);
                return (
                  <div
                    key={course.id}
                    className="flex min-h-[72px] items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-slate-950">
                        {course.name}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {folderLabel(course, folders)}
                      </p>
                    </div>
                    <p className="text-lg font-black tabular-nums text-slate-950">
                      {formatPercent(metrics.gradeSoFar)}
                    </p>
                  </div>
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
}: {
  course: Course;
  folders: CourseFolder[];
  onOpen: () => void;
}) {
  const metrics = calcMetrics(course);
  const completeAssignments = course.assignments.filter(
    (assignment) => assignment.status === "completed"
  ).length;

  return (
    <button
      type="button"
      className="w-full rounded-[1.75rem] border border-white/70 bg-white/95 p-4 text-left shadow-soft backdrop-blur active:scale-[0.99]"
      onClick={onOpen}
    >
      <div className="flex min-h-[72px] items-center gap-4">
        <div
          className="h-14 w-2 rounded-full"
          style={{ backgroundColor: course.color ?? "var(--theme-primary)" }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black tracking-tight text-slate-950">
            {course.name}
          </p>
          <p className="mt-1 truncate text-base text-slate-500">
            {folderLabel(course, folders)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black tabular-nums text-slate-950">
            {formatPercent(metrics.gradeSoFar)}
          </p>
          <p className="text-sm font-bold text-slate-400">
            {Math.round(metrics.displayCompleted)}%
          </p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{
            width: `${metrics.displayCompleted}%`,
            backgroundColor: course.color ?? "var(--theme-primary)",
          }}
        />
      </div>
      <p className="mt-3 text-base text-slate-500">
        {completeAssignments}/{course.assignments.length} assignments complete
      </p>
    </button>
  );
}

function MobileCourses({
  onOpenCourse,
}: {
  onOpenCourse: (courseId: string) => void;
}) {
  const courses = useCourseStore((state) => state.courses);
  const folders = useCourseStore((state) => state.folders);
  const addCourse = useCourseStore((state) => state.addCourse);
  const [filter, setFilter] = useState("all");

  const folderOptions = [
    { id: "all", label: "All" },
    { id: "unfiled", label: "Unfiled" },
    ...folders.map((folder) => ({
      id: folder.id,
      label: folder.year ? `${folder.year} ${folder.name}` : folder.name,
    })),
  ];
  const filteredCourses = courses.filter((course) => {
    if (filter === "all") return true;
    if (filter === "unfiled") return !course.folderId;
    return course.folderId === filter;
  });
  const defaultFolderId = folders[0]?.id ?? null;

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Courses
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              Your classes.
            </h1>
          </div>
          <button
            type="button"
            className="grid min-h-12 min-w-12 place-items-center rounded-2xl bg-slate-950 text-white shadow-soft active:scale-[0.98]"
            onClick={() => addCourse("New Course", defaultFolderId)}
            aria-label="Add course"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1">
          {folderOptions.map((option) => {
            const active = filter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={`min-h-11 shrink-0 rounded-2xl px-4 text-base font-bold ${
                  active
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      {courses.length === 0 ? (
        <EmptyCourses onAddCourse={() => addCourse("New Course", defaultFolderId)} />
      ) : (
        <div className="space-y-3">
          {filteredCourses.map((course) => (
            <MobileCourseCard
              key={course.id}
              course={course}
              folders={folders}
              onOpen={() => onOpenCourse(course.id)}
            />
          ))}
          {filteredCourses.length === 0 && (
            <p className="rounded-3xl border border-dashed border-slate-300 bg-white/90 px-5 py-8 text-center text-base text-slate-500">
              No courses in this semester yet.
            </p>
          )}
        </div>
      )}
    </div>
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
  const folders = useCourseStore((state) => state.folders);
  const renameCourse = useCourseStore((state) => state.renameCourse);
  const moveCourseToFolder = useCourseStore((state) => state.moveCourseToFolder);
  const updateCourse = useCourseStore((state) => state.updateCourse);
  const removeCourse = useCourseStore((state) => state.removeCourse);
  const addAssignment = useCourseStore((state) => state.addAssignment);
  const updateAssignment = useCourseStore((state) => state.updateAssignment);
  const removeAssignment = useCourseStore((state) => state.removeAssignment);
  const [draft, setDraft] = useState({
    title: "",
    weight: "",
    dueDate: "",
    grade: "",
  });
  const course = courses.find((item) => item.id === courseId);

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
  const submitAssignment = () => {
    const title = draft.title.trim() || "New assignment";
    const weight = Number(draft.weight);
    const grade = draft.grade === "" ? null : Number(draft.grade);
    addAssignment(course.id, {
      title,
      dueDate: draft.dueDate || null,
      weight: Number.isFinite(weight) ? weight : 0,
      grade: grade != null && Number.isFinite(grade) ? grade : null,
      status: grade != null && Number.isFinite(grade) ? "completed" : "not_started",
    });
    setDraft({ title: "", weight: "", dueDate: "", grade: "" });
  };

  return (
    <div className="min-h-[100dvh] space-y-5">
      <header className="sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-10 -mx-1 rounded-[1.75rem] border border-white/70 bg-white/90 p-3 shadow-soft backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid min-h-11 min-w-11 place-items-center rounded-2xl bg-slate-950 text-white active:scale-[0.98]"
            onClick={onBack}
            aria-label="Back to courses"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Course entry
            </p>
            <input
              className="mt-1 w-full bg-transparent text-2xl font-black tracking-tight text-slate-950 outline-none"
              value={course.name}
              onChange={(event) => renameCourse(course.id, event.target.value)}
              aria-label="Course name"
            />
          </div>
        </div>
      </header>

      <section className="rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur">
        <div className="grid grid-cols-2 gap-3">
          <MobileMetric
            label="Current"
            value={formatPercent(metrics.gradeSoFar)}
            detail="Grade so far"
          />
          <MobileMetric
            label="Progress"
            value={`${Math.round(metrics.displayCompleted)}%`}
            detail="Weight entered"
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur">
        <h2 className="text-2xl font-black tracking-tight">Course setup</h2>
        <label className="mt-5 block text-base font-bold text-slate-700">
          Semester
          <select
            className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900"
            value={course.folderId ?? ""}
            onChange={(event) =>
              moveCourseToFolder(course.id, event.target.value || null)
            }
          >
            <option value="">Unfiled</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.year ? `${folder.year} ${folder.name}` : folder.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-4 block text-base font-bold text-slate-700">
          Credit weight
          <input
            className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900"
            inputMode="decimal"
            value={course.creditWeight ?? ""}
            onChange={(event) => {
              const value = Number(event.target.value);
              updateCourse(course.id, {
                creditWeight:
                  event.target.value === "" || !Number.isFinite(value)
                    ? null
                    : value,
              });
            }}
            placeholder="Default"
          />
        </label>
        <label className="mt-4 block text-base font-bold text-slate-700">
          GPA mode
          <select
            className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900"
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
        </label>
        <label className="mt-4 flex min-h-12 items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-700">
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
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-black tracking-tight">Assignments</h2>
          <ClipboardList className="h-6 w-6 text-slate-400" />
        </div>
        <div className="mt-4 space-y-3">
          {course.assignments.map((assignment) => (
            <article
              key={assignment.id}
              className="rounded-3xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <input
                  className="min-h-11 min-w-0 flex-1 bg-transparent text-lg font-black text-slate-950 outline-none"
                  value={assignment.title}
                  onChange={(event) =>
                    updateAssignment(course.id, assignment.id, {
                      title: event.target.value,
                    })
                  }
                  aria-label="Assignment title"
                />
                <button
                  type="button"
                  className="grid min-h-11 min-w-11 place-items-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-600"
                  onClick={() => removeAssignment(course.id, assignment.id)}
                  aria-label="Delete assignment"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-base font-bold text-slate-700">
                  Weight
                  <input
                    className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-base font-semibold"
                    inputMode="decimal"
                    value={assignment.weight}
                    onChange={(event) =>
                      updateAssignment(course.id, assignment.id, {
                        weight: Number(event.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label className="text-base font-bold text-slate-700">
                  Grade
                  <input
                    className="mt-1 min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-base font-semibold"
                    inputMode="decimal"
                    value={assignment.grade ?? ""}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      updateAssignment(course.id, assignment.id, {
                        grade:
                          event.target.value === "" || !Number.isFinite(value)
                            ? null
                            : value,
                        status:
                          event.target.value === "" || !Number.isFinite(value)
                            ? assignment.status
                            : "completed",
                      });
                    }}
                  />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <input
                  className="min-h-11 rounded-2xl border border-slate-200 bg-white px-3 text-base font-semibold"
                  type="date"
                  value={assignment.dueDate ?? ""}
                  onChange={(event) =>
                    updateAssignment(course.id, assignment.id, {
                      dueDate: event.target.value || null,
                    })
                  }
                  aria-label="Due date"
                />
                <select
                  className="min-h-11 rounded-2xl border border-slate-200 bg-white px-3 text-base font-semibold"
                  value={assignment.status}
                  onChange={(event) =>
                    updateAssignment(course.id, assignment.id, {
                      status: event.target.value as AssignmentStatus,
                    })
                  }
                  aria-label="Assignment status"
                >
                  {statusOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </article>
          ))}
          {course.assignments.length === 0 && (
            <p className="rounded-3xl border border-dashed border-slate-300 px-5 py-8 text-center text-base text-slate-500">
              No assignments yet.
            </p>
          )}
        </div>

        <div className="mt-5 rounded-3xl bg-slate-50 p-4">
          <h3 className="text-lg font-black tracking-tight">Add assignment</h3>
          <div className="mt-3 space-y-3">
            <input
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold"
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Assignment name"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold"
                inputMode="decimal"
                value={draft.weight}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    weight: event.target.value,
                  }))
                }
                placeholder="Weight"
              />
              <input
                className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold"
                inputMode="decimal"
                value={draft.grade}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, grade: event.target.value }))
                }
                placeholder="Grade"
              />
            </div>
            <input
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold"
              type="date"
              value={draft.dueDate}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dueDate: event.target.value,
                }))
              }
            />
            <button
              type="button"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-base font-bold text-white shadow-soft active:scale-[0.98]"
              onClick={submitAssignment}
            >
              <Plus className="h-5 w-5" />
              Add assignment
            </button>
          </div>
        </div>
      </section>

      <button
        type="button"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-base font-bold text-rose-700"
        onClick={() => {
          removeCourse(course.id);
          onBack();
        }}
      >
        <Trash2 className="h-5 w-5" />
        Delete course
      </button>
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
    <div className="space-y-5">
      <MobileGpaHero report={report} onOpenGpa={onOpenGpa} />
      <section className="rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Breakdown
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              Your GPA map.
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
        <div className="mt-5 space-y-3">
          {rows.map((row) => (
            <div
              key={`${row.label}-${"id" in row ? row.id : row.key}`}
              className="flex min-h-[72px] items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-base font-black text-slate-950">
                  {row.label}
                </p>
                <p className="mt-1 text-base text-slate-500">
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
      <section className="rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur">
        <div className="grid grid-cols-2 gap-3">
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
        </div>
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
  const rows = [...yearRows.slice(0, 4), ...sessionRows.slice(0, 6)];

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
          {help.bullets.slice(0, 5).map((bullet) => (
            <p key={bullet} className="flex gap-3 text-base leading-relaxed text-slate-600">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <span>{bullet}</span>
            </p>
          ))}
        </div>
      </div>
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

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
          Settings
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          Match your school.
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
        <section className="rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur">
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
      ) : (
        <section className="rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-soft backdrop-blur">
          <div className="mb-4 flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-slate-400" />
            <h2 className="text-2xl font-black tracking-tight">Theme</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {customThemeOptions.map((option) => {
              const active = customThemeId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`min-h-14 rounded-2xl border px-3 text-base font-black ${
                    active
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                  onClick={() => setCustomTheme(option.id)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default function MobileApp() {
  const [activeTab, setActiveTab] = useState<MobileTab>("dashboard");
  const [gpaOpen, setGpaOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const appMode = useCourseStore((state) => state.appMode ?? "custom");
  const universityThemeId = useCourseStore(
    (state) => state.universityThemeId ?? "uoft"
  );
  const customThemeId = useCourseStore((state) => state.customThemeId ?? "classic");
  const activeTheme = getActiveTheme(appMode, universityThemeId, customThemeId);

  const showCourseDetail = activeTab === "courses" && selectedCourseId;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [activeTab, selectedCourseId]);

  return (
    <div
      className="app-shell min-h-[100dvh] bg-slate-50 text-slate-950"
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
        } as React.CSSProperties
      }
    >
      <main className="mx-auto min-h-[100dvh] w-full max-w-md px-5 pb-28 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
        {!showCourseDetail && (
          <header className="mb-5 overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-soft backdrop-blur">
            <div
              className="h-24 bg-cover bg-center"
              style={{
                backgroundImage: activeTheme.backgroundImage
                  ? `linear-gradient(90deg, rgba(15,23,42,0.68), rgba(15,23,42,0.12)), url(${activeTheme.backgroundImage})`
                  : `linear-gradient(135deg, var(--theme-primary), var(--theme-accent))`,
                backgroundPosition: activeTheme.position ?? "center",
              }}
            />
            <div className="-mt-8 flex items-end justify-between gap-4 px-4 pb-4">
              <div>
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-white shadow-soft ring-4 ring-white">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  {activeTheme.label}
                </p>
                <h1 className="text-2xl font-black tracking-tight">MarkMate</h1>
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
            onGoCourses={() => {
              setSelectedCourseId(null);
              setActiveTab("courses");
            }}
          />
        ) : activeTab === "courses" ? (
          <MobileCourses onOpenCourse={setSelectedCourseId} />
        ) : activeTab === "gpa" ? (
          <MobileGpa onOpenGpa={() => setGpaOpen(true)} />
        ) : (
          <MobileSettings />
        )}
      </main>

      {!showCourseDetail && (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 border-t border-white/70 bg-white/90 px-4 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] pt-2 shadow-[0_-18px_44px_-28px_rgba(15,23,42,0.45)] backdrop-blur"
          style={{ position: "fixed", zIndex: 20 }}
        >
          <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
            {mobileTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition active:scale-[0.98] ${
                    active ? "text-white" : "text-slate-500"
                  }`}
                  style={
                    active
                      ? { backgroundColor: activeTheme.primaryColor }
                      : undefined
                  }
                  onClick={() => {
                    setSelectedCourseId(null);
                    setActiveTab(tab.id);
                  }}
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
    </div>
  );
}
