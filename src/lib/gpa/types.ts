export type UniversityId =
  | "uoft"
  | "tmu"
  | "western"
  | "queens"
  | "guelph"
  | "brock"
  | "york"
  | "waterloo"
  | "laurier"
  | "uottawa"
  | "mcgill";

export type AcademicTerm = "Fall" | "Winter" | "Summer" | "FallWinter";

export type GradeInput =
  | { kind: "percent"; value: number }
  | { kind: "letter"; value: string }
  | { kind: "designation"; value: string }
  | { kind: "none" };

export type GradeMode =
  | "graded"
  | "credit-no-credit"
  | "pass-fail"
  | "personal-interest-credit"
  | "satisfactory-unsatisfactory"
  | "audit"
  | "transfer"
  | "extra"
  | "deferred"
  | "incomplete";

export type CourseStatus = "planned" | "in-progress" | "completed";

export type CourseGradeRecord = {
  id: string;
  code: string;
  title?: string;
  universityId?: UniversityId;
  year: 1 | 2 | 3 | 4;
  term: AcademicTerm;
  /**
   * Use each school's own weight system:
   * - UofT / Western / Waterloo / Laurier / Brock / Guelph: often 0.5 one-term, 1.0 full-year.
   * - TMU: usually 1.0 one-term, 2.0 two-term.
   * - Queen's / uOttawa / McGill: usually 3.0 one-term, 6.0 full-year.
   */
  creditWeight?: number;
  grade: GradeInput;
  status?: CourseStatus;
  gradeMode?: GradeMode;
  /** Manual override. Use false for transfer, extra, unsupported, faculty-specific exceptions, etc. */
  includeInGpa?: boolean;
  /** Use this to link equivalent repeated courses when course codes changed. */
  repeatGroupId?: string;
  /** Higher attempt number wins for schools that keep the latest attempt. */
  attempt?: number;
  /** ISO date string. Used as a tie-breaker for repeated attempts. */
  completedAt?: string;
  notes?: string;
};

export type GradeScaleKind = "points" | "percent";
export type RoundingMode = "normal-0" | "normal-1" | "normal-2" | "truncate-2" | "truncate-3" | "none";
export type RepeatPolicy = "include-all" | "latest-attempt-only" | "best-attempt-only" | "manual-review";
export type DesignationRule = "exclude" | "zero" | "floor";
export type PreConversionRoundingMode = "nearest-integer";

export type GradeBand = {
  letter: string;
  minPercent: number;
  maxPercent: number;
  /**
   * For point schools: grade point value.
   * For percent schools: fallback percent value if user only supplies a letter/designation.
   */
  value: number;
};

export type UniversityPolicy = {
  id: UniversityId;
  name: string;
  shortName: string;
  scaleKind: GradeScaleKind;
  scaleLabel: string;
  maxValue: number;
  passingPercent: number;
  defaultCreditWeight: number;
  displayPrecision: 0 | 1 | 2 | 3;
  roundingMode: RoundingMode;
  /** Some schools round the final percent before letter/point conversion. */
  preConversionRounding?: PreConversionRoundingMode;
  repeatPolicy: RepeatPolicy;
  repeatAutoDetectByCode: boolean;
  /** Optional override used only when calculating the cumulative report. */
  cumulativeRepeatPolicy?: RepeatPolicy;
  cumulativeRepeatAutoDetectByCode?: boolean;
  /** ISO date. Repeats before this date stay included. Missing dates stay included with a warning. */
  cumulativeRepeatEffectiveFrom?: string;
  /** Used by percentage-average schools where very low failures are calculated at a floor value. */
  percentFloorForAverage?: number;
  /** If gradeMode is pass-fail and the final grade is F/FAIL/etc, should it count as a failure? */
  passFailFailureCounts: boolean;
  /** Exact transcript symbols/designations. Matched after uppercase/trim normalization. */
  designationRules: Record<string, DesignationRule>;
  gradeBands: GradeBand[];
  termAverageLabel: string;
  cumulativeAverageLabel: string;
  yearlyAverageLabel: string;
  notes: string[];
  officialUrls: string[];
};

export type ResolvedGrade = {
  included: boolean;
  value: number | null;
  letter?: string;
  normalizedInput?: string;
  reason?: string;
  warning?: string;
};

export type IncludedCourse = {
  record: CourseGradeRecord;
  value: number;
  weightedValue: number;
  creditWeight: number;
  letter?: string;
  warning?: string;
};

export type ExcludedCourse = {
  record: CourseGradeRecord;
  reason: string;
};

export type AverageResult = {
  policy: UniversityPolicy;
  label: string;
  rawAverage: number | null;
  displayAverage: number | null;
  creditsIncluded: number;
  weightedTotal: number;
  includedCourses: IncludedCourse[];
  excludedCourses: ExcludedCourse[];
  warnings: string[];
};

export type TermAverageResult = AverageResult & {
  year: 1 | 2 | 3 | 4;
  term: AcademicTerm;
};

export type YearAverageResult = {
  year: 1 | 2 | 3 | 4;
  fall: TermAverageResult;
  winter: TermAverageResult;
  summer: TermAverageResult;
  /** Fall + Winter + explicit FallWinter full-year courses. Useful for UofT-style AGPA/Fall-Winter views. */
  fallWinter: AverageResult;
  /** Fall + Winter + Summer + explicit FallWinter courses. Useful for full academic-year summaries. */
  fullAcademicYear: AverageResult;
};

export type UniversityGpaReport = {
  policy: UniversityPolicy;
  years: YearAverageResult[];
  cumulative: AverageResult;
};
