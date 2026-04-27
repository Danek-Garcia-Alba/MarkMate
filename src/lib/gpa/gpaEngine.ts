import { UNIVERSITY_POLICIES, getUniversityPolicy } from "./universityPolicies";
import type {
  AcademicTerm,
  AverageResult,
  CourseGradeRecord,
  ExcludedCourse,
  GradeBand,
  IncludedCourse,
  ResolvedGrade,
  TermAverageResult,
  UniversityGpaReport,
  UniversityId,
  UniversityPolicy,
  YearAverageResult,
} from "./types";

const TERM_ORDER: Record<AcademicTerm, number> = {
  Fall: 1,
  Winter: 2,
  Summer: 3,
  FallWinter: 4,
};

const PASS_TOKENS = new Set(["P", "PASS", "PAS", "PAS+", "PSD", "CR", "CREDIT", "SAT", "S", "SATISFACTORY", "OP"]);
const FAIL_TOKENS = new Set(["F", "FAIL", "FL", "FAI", "F-S", "FS", "FNA", "XF", "DR", "U", "UNSAT", "UNSATISFACTORY"]);
const CREDIT_NO_CREDIT_PASS = new Set(["CR", "CREDIT", "PASS", "P"]);
const CREDIT_NO_CREDIT_FAIL = new Set(["NCR", "NC", "NO-CREDIT", "NOCREDIT", "U", "UNSAT", "UNSATISFACTORY"]);
const SAT_UNSAT_TOKENS = new Set(["S", "SAT", "SATISFACTORY", "U", "UNSAT", "UNSATISFACTORY", "NS", "NOTSATISFACTORY"]);

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function normalizeToken(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "").replace("−", "-");
}

function normalizeCourseCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function findBandFromPercent(policy: UniversityPolicy, percent: number): GradeBand | undefined {
  const safe = clampPercent(percent);
  return policy.gradeBands.find((band) => safe >= band.minPercent && safe <= band.maxPercent);
}

function findBandFromLetter(policy: UniversityPolicy, letter: string): GradeBand | undefined {
  const normalized = normalizeToken(letter);
  return policy.gradeBands.find((band) => normalizeToken(band.letter) === normalized);
}

function roundPercentBeforeConversion(percent: number, policy: UniversityPolicy): number {
  if (policy.preConversionRounding === "nearest-integer") {
    return clampPercent(Math.round(percent));
  }
  return percent;
}

function roundOrTruncate(rawAverage: number | null, policy: UniversityPolicy): number | null {
  if (rawAverage === null) return null;
  const n = rawAverage + Number.EPSILON;
  switch (policy.roundingMode) {
    case "normal-0":
      return Math.round(n);
    case "normal-1":
      return Math.round(n * 10) / 10;
    case "normal-2":
      return Math.round(n * 100) / 100;
    case "truncate-2":
      return Math.trunc(n * 100) / 100;
    case "truncate-3":
      return Math.trunc(n * 1000) / 1000;
    case "none":
      return rawAverage;
  }
}

function percentAverageValue(policy: UniversityPolicy, percent: number): number {
  const safe = clampPercent(percent);
  return typeof policy.percentFloorForAverage === "number" ? Math.max(policy.percentFloorForAverage, safe) : safe;
}

function zeroValueForPolicy(policy: UniversityPolicy): number {
  if (policy.scaleKind === "percent") return typeof policy.percentFloorForAverage === "number" ? policy.percentFloorForAverage : 0;
  return 0;
}

function pushUniqueWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning)) warnings.push(warning);
}

function resolvePassFail(token: string, policy: UniversityPolicy): ResolvedGrade | null {
  if (PASS_TOKENS.has(token)) {
    return { included: false, value: null, normalizedInput: token, reason: "Passing Pass/Fail-style grade is excluded from GPA/average." };
  }
  if (FAIL_TOKENS.has(token)) {
    if (!policy.passFailFailureCounts) {
      return { included: false, value: null, normalizedInput: token, reason: `${policy.shortName} Pass/Fail or alternative failed result is excluded from GPA/average.` };
    }
    return { included: true, value: zeroValueForPolicy(policy), normalizedInput: token, letter: token, reason: `${token} counts as a failing grade for ${policy.shortName}.` };
  }
  return null;
}

function resolveCreditNoCredit(token: string, policy: UniversityPolicy): ResolvedGrade | null {
  // UofT special case: NC% is a GPA-counting no-credit result worth 0.0.
  if (token === "NC%" && policy.designationRules[token] === "zero") {
    return { included: true, value: 0, normalizedInput: token, letter: token, reason: "NC% counts as 0.0 by UofT transcript policy." };
  }
  if (CREDIT_NO_CREDIT_PASS.has(token)) {
    return { included: false, value: null, normalizedInput: token, reason: "Credit/No Credit pass is excluded from GPA/average." };
  }
  if (CREDIT_NO_CREDIT_FAIL.has(token)) {
    return { included: false, value: null, normalizedInput: token, reason: "Credit/No Credit fail/no-credit is excluded unless the school uses a special GPA-counting symbol like UofT NC%." };
  }
  return null;
}

export function resolveCourseGrade(record: CourseGradeRecord, policy: UniversityPolicy): ResolvedGrade {
  if (record.includeInGpa === false) {
    return { included: false, value: null, reason: "Manually excluded from GPA/average." };
  }

  if (record.status === "planned" || record.status === "in-progress") {
    return { included: false, value: null, reason: "Course is not completed yet." };
  }

  const creditWeight = record.creditWeight ?? policy.defaultCreditWeight;
  if (!Number.isFinite(creditWeight) || creditWeight <= 0) {
    return { included: false, value: null, reason: "Credit weight is missing or zero." };
  }

  const mode = record.gradeMode ?? "graded";
  if (["audit", "transfer", "extra", "deferred", "incomplete"].includes(mode)) {
    return { included: false, value: null, reason: `${mode} courses are excluded from this GPA/average.` };
  }

  if (record.grade.kind === "none") {
    return { included: false, value: null, reason: "No final grade has been recorded." };
  }

  if (record.grade.kind === "percent") {
    const postedPercent = clampPercent(record.grade.value);
    const percent = roundPercentBeforeConversion(postedPercent, policy);
    const roundingWarning = percent !== postedPercent
      ? `${policy.shortName} rounds ${postedPercent}% to ${percent}% before converting to the grade scale.`
      : undefined;

    if (mode === "credit-no-credit") {
      if (percent >= policy.passingPercent) {
        return { included: false, value: null, normalizedInput: `${percent}`, reason: "Credit/No Credit pass is excluded from GPA/average." };
      }
      return { included: false, value: null, normalizedInput: `${percent}`, reason: "Credit/No Credit no-credit is excluded unless the school posts a GPA-counting symbol." };
    }

    if (mode === "satisfactory-unsatisfactory") {
      return { included: false, value: null, normalizedInput: `${percent}`, reason: "Satisfactory/Unsatisfactory grades are excluded from GPA/average." };
    }

    if (mode === "pass-fail") {
      if (percent >= policy.passingPercent) {
        return { included: false, value: null, normalizedInput: `${percent}`, reason: "Passing Pass/Fail grade is excluded from GPA/average." };
      }
      if (!policy.passFailFailureCounts) {
        return { included: false, value: null, normalizedInput: `${percent}`, reason: `${policy.shortName} failed Pass/Fail result is excluded from GPA/average.` };
      }
      return { included: true, value: zeroValueForPolicy(policy), normalizedInput: `${percent}`, letter: "F", reason: "Failed Pass/Fail attempt counts as a failure." };
    }

    const band = findBandFromPercent(policy, percent);
    const value = policy.scaleKind === "percent" ? percentAverageValue(policy, percent) : (band?.value ?? 0);
    const floorWarning = policy.scaleKind === "percent" && policy.percentFloorForAverage !== undefined && percent < policy.percentFloorForAverage
      ? `${policy.shortName} average policy calculates ${percent}% as ${policy.percentFloorForAverage}%.`
      : undefined;
    const warning = [roundingWarning, floorWarning].filter(Boolean).join(" ");
    return { included: true, value, letter: band?.letter, normalizedInput: `${percent}`, warning };
  }

  const token = normalizeToken(record.grade.value);

  if (mode === "credit-no-credit") {
    const cncr = resolveCreditNoCredit(token, policy);
    if (cncr) return cncr;
  }

  if (mode === "satisfactory-unsatisfactory") {
    if (SAT_UNSAT_TOKENS.has(token)) {
      return { included: false, value: null, normalizedInput: token, reason: "Satisfactory/Unsatisfactory grades are excluded from GPA/average." };
    }
  }

  if (mode === "pass-fail" || mode === "personal-interest-credit") {
    const passFail = resolvePassFail(token, policy);
    if (passFail) return passFail;
  }

  const designationRule = policy.designationRules[token];
  if (designationRule === "exclude") {
    return { included: false, value: null, normalizedInput: token, reason: `${token} is excluded by ${policy.shortName} policy.` };
  }
  if (designationRule === "zero") {
    return { included: true, value: zeroValueForPolicy(policy), normalizedInput: token, letter: token, reason: `${token} counts as a failing grade.` };
  }
  if (designationRule === "floor") {
    return {
      included: true,
      value: zeroValueForPolicy(policy),
      normalizedInput: token,
      letter: token,
      warning: `${token} was included at ${zeroValueForPolicy(policy)} because ${policy.shortName} applies a failure floor for average calculations.`,
    };
  }

  const band = findBandFromLetter(policy, token);
  if (!band) {
    return { included: false, value: null, normalizedInput: token, reason: `Unknown grade/designation: ${token}.` };
  }

  if (policy.scaleKind === "percent") {
    const value = percentAverageValue(policy, band.value);
    return {
      included: true,
      value,
      letter: band.letter,
      normalizedInput: token,
      warning: `${policy.shortName} calculates averages from numeric marks. Letter-only ${band.letter} used a ${value}% fallback. Prefer storing the exact final percentage.`,
    };
  }

  return { included: true, value: band.value, letter: band.letter, normalizedInput: token };
}

function sortByAttempt(a: IncludedCourse, b: IncludedCourse): number {
  const attemptA = a.record.attempt ?? 0;
  const attemptB = b.record.attempt ?? 0;
  if (attemptA !== attemptB) return attemptA - attemptB;

  const dateA = a.record.completedAt ? Date.parse(a.record.completedAt) : Number.NaN;
  const dateB = b.record.completedAt ? Date.parse(b.record.completedAt) : Number.NaN;
  if (Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) return dateA - dateB;

  if (a.record.year !== b.record.year) return a.record.year - b.record.year;
  return TERM_ORDER[a.record.term] - TERM_ORDER[b.record.term];
}

function repeatKeyFor(record: CourseGradeRecord, policy: UniversityPolicy): string | null {
  if (record.repeatGroupId?.trim()) return `group:${record.repeatGroupId.trim().toUpperCase()}`;
  if (policy.repeatAutoDetectByCode && record.code.trim()) return `code:${normalizeCourseCode(record.code)}`;
  return null;
}

function applyRepeatPolicy(
  included: IncludedCourse[],
  excluded: ExcludedCourse[],
  warnings: string[],
  policy: UniversityPolicy,
): { included: IncludedCourse[]; excluded: ExcludedCourse[] } {
  if (policy.repeatPolicy === "include-all") return { included, excluded };

  if (policy.repeatPolicy === "manual-review") {
    const repeated = included.filter((item) => item.record.repeatGroupId);
    if (repeated.length > 0) {
      warnings.push(`${policy.shortName} repeat rules can be faculty/plan-specific. MarkMate kept all grade-bearing attempts; manually exclude any attempt your faculty/transcript excludes.`);
    }
    return { included, excluded };
  }

  const groups = new Map<string, IncludedCourse[]>();
  const ungrouped: IncludedCourse[] = [];

  for (const item of included) {
    const key = repeatKeyFor(item.record, policy);
    if (!key) {
      ungrouped.push(item);
      continue;
    }
    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  }

  const kept: IncludedCourse[] = [...ungrouped];
  const removed: ExcludedCourse[] = [...excluded];

  for (const group of groups.values()) {
    const protectedAttempts: IncludedCourse[] = [];
    const eligibleAttempts: IncludedCourse[] = [];

    for (const item of group) {
      if (!policy.cumulativeRepeatEffectiveFrom) {
        eligibleAttempts.push(item);
        continue;
      }

      if (!item.record.completedAt) {
        protectedAttempts.push(item);
        pushUniqueWarning(
          warnings,
          `${policy.shortName} repeat rules are date-sensitive. Repeated courses without completed dates were kept; add dates if the repeat is from Summer 2026 or later.`
        );
        continue;
      }

      const completedAt = Date.parse(item.record.completedAt);
      const effectiveFrom = Date.parse(policy.cumulativeRepeatEffectiveFrom);
      if (Number.isFinite(completedAt) && completedAt >= effectiveFrom) {
        eligibleAttempts.push(item);
      } else {
        protectedAttempts.push(item);
      }
    }

    if (eligibleAttempts.length <= 1) {
      kept.push(...protectedAttempts, ...eligibleAttempts);
      continue;
    }

    const winner = policy.repeatPolicy === "best-attempt-only"
      ? [...eligibleAttempts].sort((a, b) => (a.value === b.value ? sortByAttempt(a, b) : a.value - b.value)).at(-1)
      : [...eligibleAttempts].sort(sortByAttempt).at(-1);

    if (!winner) continue;
    kept.push(...protectedAttempts, winner);

    for (const item of eligibleAttempts) {
      if (item.record.id === winner.record.id) continue;
      removed.push({
        record: item.record,
        reason: policy.repeatPolicy === "best-attempt-only"
          ? `Repeat excluded by ${policy.shortName} policy; highest grade-bearing attempt kept.`
          : `Repeat excluded by ${policy.shortName} policy; latest grade-bearing attempt kept.`,
      });
    }
  }

  return { included: kept, excluded: removed };
}

export function calculateAverage(
  records: CourseGradeRecord[],
  policyOrId: UniversityPolicy | UniversityId,
  label = "Average",
  options: { cumulative?: boolean } = {},
): AverageResult {
  const basePolicy = typeof policyOrId === "string" ? getUniversityPolicy(policyOrId) : policyOrId;
  const policy =
    options.cumulative && basePolicy.cumulativeRepeatPolicy
      ? {
          ...basePolicy,
          repeatPolicy: basePolicy.cumulativeRepeatPolicy,
          repeatAutoDetectByCode:
            basePolicy.cumulativeRepeatAutoDetectByCode ??
            basePolicy.repeatAutoDetectByCode,
        }
      : basePolicy;
  const includedBeforeRepeats: IncludedCourse[] = [];
  const excluded: ExcludedCourse[] = [];
  const warnings: string[] = [];

  for (const record of records) {
    const resolved = resolveCourseGrade(record, policy);
    if (!resolved.included || resolved.value === null) {
      excluded.push({ record, reason: resolved.reason ?? "Excluded from calculation." });
      continue;
    }

    const creditWeight = record.creditWeight ?? policy.defaultCreditWeight;
    const includedCourse: IncludedCourse = {
      record,
      value: resolved.value,
      weightedValue: resolved.value * creditWeight,
      creditWeight,
      letter: resolved.letter,
      warning: resolved.warning,
    };
    if (resolved.warning) warnings.push(`${record.code || record.title || record.id}: ${resolved.warning}`);
    includedBeforeRepeats.push(includedCourse);
  }

  const { included, excluded: excludedAfterRepeats } = applyRepeatPolicy(includedBeforeRepeats, excluded, warnings, policy);
  const creditsIncluded = included.reduce((sum, item) => sum + item.creditWeight, 0);
  const weightedTotal = included.reduce((sum, item) => sum + item.weightedValue, 0);
  const rawAverage = creditsIncluded > 0 ? weightedTotal / creditsIncluded : null;
  const displayAverage = roundOrTruncate(rawAverage, policy);

  return {
    policy,
    label,
    rawAverage,
    displayAverage,
    creditsIncluded,
    weightedTotal,
    includedCourses: included.sort((a, b) => sortByAttempt(a, b)),
    excludedCourses: excludedAfterRepeats,
    warnings,
  };
}

function recordsForTerm(records: CourseGradeRecord[], year: 1 | 2 | 3 | 4, term: AcademicTerm): CourseGradeRecord[] {
  return records.filter((record) => record.year === year && record.term === term);
}

function recordsForTerms(records: CourseGradeRecord[], year: 1 | 2 | 3 | 4, terms: AcademicTerm[]): CourseGradeRecord[] {
  const allowed = new Set(terms);
  return records.filter((record) => record.year === year && allowed.has(record.term));
}

function termAverage(records: CourseGradeRecord[], policy: UniversityPolicy, year: 1 | 2 | 3 | 4, term: AcademicTerm): TermAverageResult {
  return {
    ...calculateAverage(recordsForTerm(records, year, term), policy, `${policy.termAverageLabel} · Year ${year} ${term}`),
    year,
    term,
  };
}

export function calculateUniversityReport(records: CourseGradeRecord[], universityId: UniversityId): UniversityGpaReport {
  const policy = UNIVERSITY_POLICIES[universityId];
  const years = [1, 2, 3, 4].map((yearNumber) => {
    const year = yearNumber as 1 | 2 | 3 | 4;
    const fall = termAverage(records, policy, year, "Fall");
    const winter = termAverage(records, policy, year, "Winter");
    const summer = termAverage(records, policy, year, "Summer");
    const fallWinter = calculateAverage(
      recordsForTerms(records, year, ["Fall", "Winter", "FallWinter"]),
      policy,
      `${policy.yearlyAverageLabel} · Year ${year} Fall/Winter`,
    );
    const fullAcademicYear = calculateAverage(
      recordsForTerms(records, year, ["Fall", "Winter", "Summer", "FallWinter"]),
      policy,
      `${policy.yearlyAverageLabel} · Year ${year}`,
    );

    return { year, fall, winter, summer, fallWinter, fullAcademicYear } satisfies YearAverageResult;
  });

  return {
    policy,
    years,
    cumulative: calculateAverage(records, policy, policy.cumulativeAverageLabel, { cumulative: true }),
  };
}

export function formatAverage(result: AverageResult): string {
  if (result.displayAverage === null) return "—";
  const decimals = result.policy.displayPrecision;
  const suffix = result.policy.scaleKind === "percent" ? "%" : ` / ${result.policy.maxValue}`;
  return `${result.displayAverage.toFixed(decimals)}${suffix}`;
}

export function createDefaultUniversityTerms() {
  return [1, 2, 3, 4].flatMap((year) => (["Fall", "Winter", "Summer"] as const).map((term) => ({
    id: `year-${year}-${term.toLowerCase()}`,
    year: year as 1 | 2 | 3 | 4,
    term,
    name: `Year ${year} · ${term}`,
  })));
}

export function toCourseGradeRecordFromMarkMateCourse(course: {
  id: string;
  code?: string;
  name?: string;
  year?: number;
  term?: string;
  creditWeight?: number;
  finalPercent?: number | null;
  finalLetter?: string | null;
  designation?: string | null;
  includeInGpa?: boolean;
  status?: CourseGradeRecord["status"];
  gradeMode?: CourseGradeRecord["gradeMode"];
  repeatGroupId?: string;
  attempt?: number;
  completedAt?: string;
}): CourseGradeRecord {
  const term = (course.term === "Fall" || course.term === "Winter" || course.term === "Summer" || course.term === "FallWinter")
    ? course.term
    : "Fall";
  const year = [1, 2, 3, 4].includes(course.year ?? 1) ? (course.year as 1 | 2 | 3 | 4) : 1;
  const grade: CourseGradeRecord["grade"] = typeof course.finalPercent === "number"
    ? { kind: "percent", value: course.finalPercent }
    : course.finalLetter
      ? { kind: "letter", value: course.finalLetter }
      : course.designation
        ? { kind: "designation", value: course.designation }
        : { kind: "none" };

  return {
    id: course.id,
    code: course.code ?? course.name ?? course.id,
    title: course.name,
    year,
    term,
    creditWeight: course.creditWeight,
    grade,
    includeInGpa: course.includeInGpa,
    status: course.status ?? "completed",
    gradeMode: course.gradeMode ?? "graded",
    repeatGroupId: course.repeatGroupId,
    attempt: course.attempt,
    completedAt: course.completedAt,
  };
}
