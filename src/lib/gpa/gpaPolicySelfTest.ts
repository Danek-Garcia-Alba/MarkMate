import { calculateAverage, calculateUniversityReport, formatAverage } from "./gpaEngine";
import type { CourseGradeRecord, UniversityId } from "./types";

function course(
  id: string,
  universityId: UniversityId,
  code: string,
  value: number | string,
  creditWeight?: number,
  extra?: Partial<CourseGradeRecord>,
): CourseGradeRecord {
  const grade = typeof value === "number"
    ? { kind: "percent" as const, value }
    : /^[A-Za-z+\-%]+$/.test(value)
      ? { kind: "letter" as const, value }
      : { kind: "designation" as const, value };
  return {
    id,
    universityId,
    code,
    year: 1,
    term: "Fall",
    creditWeight,
    grade,
    status: "completed",
    gradeMode: "graded",
    ...extra,
  };
}

function assertEqual(label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertClose(label: string, actual: number | null, expected: number, tolerance = 0.00001) {
  if (actual === null || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, got ${String(actual)}`);
  }
}

export function runGpaPolicySelfTest() {
  // UofT: weighted 4.0, CR excluded, NC% counts zero.
  let r = calculateAverage([
    course("u1", "uoft", "MAT135", 86, 0.5),
    course("u2", "uoft", "ENG100", "CR", 0.5, { grade: { kind: "designation", value: "CR" }, gradeMode: "credit-no-credit" }),
    course("u3", "uoft", "CSC108", "NC%", 0.5, { grade: { kind: "designation", value: "NC%" }, gradeMode: "credit-no-credit" }),
  ], "uoft");
  assertClose("UofT weighted GPA with NC%", r.displayAverage, 2.0);
  assertEqual("UofT included count", r.includedCourses.length, 2);
  assertEqual("UofT excluded CR", r.excludedCourses.length, 1);

  r = calculateAverage([
    course("u4", "uoft", "MAT136", 84.5, 0.5),
  ], "uoft");
  assertClose("UofT does not pre-round percentages", r.displayAverage, 3.7);

  // TMU: latest repeated attempt counts even if lower.
  r = calculateAverage([
    course("t1", "tmu", "CPS109", 85, 1, { attempt: 1 }),
    course("t2", "tmu", "CPS109", 51, 1, { attempt: 2 }),
  ], "tmu");
  assertClose("TMU latest repeated attempt", r.displayAverage, 0.67);
  assertEqual("TMU removes first attempt", r.excludedCourses.length, 1);

  r = calculateAverage([
    course("t3", "tmu", "CPS209", 84.5, 1),
  ], "tmu");
  assertClose("TMU rounds percentage before conversion", r.displayAverage, 4.0);

  // Western correction: latest repeated attempt only; marks below 40 floor to 40.
  r = calculateAverage([
    course("w1", "western", "PSY1000", 90, 0.5, { attempt: 1 }),
    course("w2", "western", "PSY1000", 30, 0.5, { attempt: 2 }),
  ], "western");
  assertClose("Western latest repeat and 40 floor", r.displayAverage, 40);
  assertEqual("Western removes first attempt", r.excludedCourses.length, 1);

  // Queen's: best repeated attempt counts, CR excluded, F normally counts 0.
  r = calculateAverage([
    course("q1", "queens", "WRIT125", 52, 3, { attempt: 1 }),
    course("q2", "queens", "WRIT125", 89, 3, { attempt: 2 }),
    course("q3", "queens", "HIST100", "CR", 3, { grade: { kind: "designation", value: "CR" } }),
  ], "queens");
  assertClose("Queen's best repeat", r.displayAverage, 4.0);
  assertEqual("Queen's removes lower repeat and CR", r.excludedCourses.length, 2);

  // Guelph correction: numeric failed grades count; alternative symbol F/WF excluded, not zeroed.
  r = calculateAverage([
    course("g1", "guelph", "BIOL1070", 42, 0.5),
    course("g2", "guelph", "CHEM1040", "F", 0.5, { grade: { kind: "designation", value: "F" }, gradeMode: "pass-fail" }),
    course("g3", "guelph", "HIST1000", "CR", 0.5, { grade: { kind: "designation", value: "CR" }, gradeMode: "credit-no-credit" }),
  ], "guelph");
  assertClose("Guelph numeric failure counts exactly", r.displayAverage, 42);
  assertEqual("Guelph alternative F and CR excluded", r.excludedCourses.length, 2);

  let report = calculateUniversityReport([
    course("g4", "guelph", "MATH1080", 90, 0.5, { completedAt: "2025-12-15" }),
    course("g5", "guelph", "MATH1080", 40, 0.5, { completedAt: "2026-04-15" }),
  ], "guelph");
  assertClose("Guelph pre-Summer 2026 repeats remain cumulative", report.cumulative.displayAverage, 65);

  report = calculateUniversityReport([
    course("g6", "guelph", "MATH1080", 90, 0.5, { term: "Summer", completedAt: "2026-08-15" }),
    course("g7", "guelph", "MATH1080", 40, 0.5, { term: "Summer", completedAt: "2026-08-20" }),
  ], "guelph");
  assertClose("Guelph Summer 2026 cumulative keeps highest repeat", report.cumulative.displayAverage, 90);
  assertClose("Guelph Summer 2026 semester keeps each attempt", report.years[0].summer.displayAverage, 65);

  // Brock: floor below 45, latest repeat, whole-percent rounded.
  r = calculateAverage([
    course("b1", "brock", "COSC1P02", 70, 0.5, { attempt: 1 }),
    course("b2", "brock", "COSC1P02", 30, 0.5, { attempt: 2 }),
    course("b3", "brock", "MATH1P97", 86, 0.5),
  ], "brock");
  assertClose("Brock 45 floor plus rounding", r.displayAverage, 66);
  assertEqual("Brock removes first repeat", r.excludedCourses.length, 1);
  assertEqual("Brock display", formatAverage(r), "66%");

  // York: 9-point weighted, latest repeat, Pass/Fail F excluded if explicitly pass-fail mode.
  r = calculateAverage([
    course("y1", "york", "AP/HIST1040", 90, 6),
    course("y2", "york", "SC/CHEM2011", "F", 3, { gradeMode: "pass-fail" }),
  ], "york");
  assertClose("York pass/fail F excluded", r.displayAverage, 9);
  assertEqual("York pass/fail F excluded count", r.excludedCourses.length, 1);

  r = calculateAverage([
    course("y3", "york", "AP/ECON1000", 89.5, 3),
  ], "york");
  assertClose("York percent guideline is not pre-rounded", r.displayAverage, 8);

  // Waterloo: low grades floor to 32, WF floor to 32, CR excluded, manual repeat warning.
  r = calculateAverage([
    course("wa1", "waterloo", "MATH135", 20, 0.5),
    course("wa2", "waterloo", "CS135", "WF", 0.5, { grade: { kind: "designation", value: "WF" } }),
    course("wa3", "waterloo", "PD1", "CR", 0.5, { grade: { kind: "designation", value: "CR" }, gradeMode: "credit-no-credit" }),
  ], "waterloo");
  assertClose("Waterloo 32 floor and WF", r.displayAverage, 32);
  assertEqual("Waterloo CR excluded", r.excludedCourses.length, 1);

  // Laurier: 12-point weighted, second/later repeat wins, F/XF/DR zero.
  r = calculateAverage([
    course("l1", "laurier", "BU111", 90, 0.5, { attempt: 1 }),
    course("l2", "laurier", "BU111", 53, 0.5, { attempt: 2 }),
    course("l3", "laurier", "EC120", "XF", 0.5),
  ], "laurier");
  assertClose("Laurier latest repeat and XF", r.displayAverage, 1);

  // uOttawa: 10-point, latest repeat even if lower, ABS/EIN zero, CR excluded.
  r = calculateAverage([
    course("o1", "uottawa", "MAT1320", 90, 3, { attempt: 1 }),
    course("o2", "uottawa", "MAT1320", 50, 3, { attempt: 2 }),
    course("o3", "uottawa", "ENG1100", "CR", 3, { grade: { kind: "designation", value: "CR" } }),
  ], "uottawa");
  assertClose("uOttawa latest repeat", r.displayAverage, 2);
  assertEqual("uOttawa removes repeat and CR", r.excludedCourses.length, 2);

  r = calculateAverage([
    course("o4", "uottawa", "BIO1140", 49.5, 3),
  ], "uottawa");
  assertClose("uOttawa rounds percentage before conversion", r.displayAverage, 2);

  // McGill: truncate to 2 decimals, repeats include all, S/U U excluded, J/KF zero.
  r = calculateAverage([
    course("m1", "mcgill", "MATH140", 85, 3), // 4.0
    course("m2", "mcgill", "MATH140", 80, 3), // repeat included, 3.7
    course("m3", "mcgill", "HIST200", "U", 3, { gradeMode: "satisfactory-unsatisfactory" }),
    course("m4", "mcgill", "COMP202", "J", 3), // zero
  ], "mcgill");
  assertClose("McGill truncate and repeat include all", r.displayAverage, 2.56);
  assertEqual("McGill U excluded", r.excludedCourses.length, 1);

  return { passed: true };
}
