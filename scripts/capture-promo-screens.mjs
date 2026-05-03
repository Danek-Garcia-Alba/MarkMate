import {spawn} from "node:child_process";
import {mkdirSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";
import {chromium} from "playwright";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "public", "remotion-captures");
const baseUrl = "http://127.0.0.1:5173";

const schools = [
  "uoft",
  "western",
  "queens",
  "york",
  "tmu",
  "waterloo",
  "laurier",
  "brock",
  "guelph",
  "uottawa",
  "mcgill",
];

const folderColors = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#be123c",
  "#c2410c",
  "#4d7c0f",
  "#0369a1",
  "#52525b",
];

function universityFolders() {
  return ["Year 1", "Year 2", "Year 3", "Year 4"].flatMap((year, yearIndex) =>
    ["Fall", "Winter", "Summer"].map((term, termIndex) => ({
      id: `${year.toLowerCase().replace(/\s+/g, "-")}-${term.toLowerCase()}`,
      name: term,
      year,
      color: folderColors[(yearIndex * 3 + termIndex) % folderColors.length],
      collapsed: false,
    }))
  );
}

const assignments = {
  bridge: [
    {
      id: "a-bridge-sketch",
      title: "Bridge sketch",
      dueDate: "2026-05-11",
      weight: 20,
      status: "completed",
      grade: 88,
      late: false,
      latePenalty: 10,
    },
    {
      id: "a-structures-lab",
      title: "Structures lab",
      dueDate: "2026-05-18",
      weight: 15,
      status: "in_progress",
      grade: null,
      late: false,
      latePenalty: 10,
    },
    {
      id: "a-final-model",
      title: "Final model",
      dueDate: "2026-06-02",
      weight: 30,
      status: "not_started",
      grade: null,
      late: false,
      latePenalty: 10,
    },
    {
      id: "a-exam",
      title: "Exam",
      dueDate: "2026-06-15",
      weight: 35,
      status: "not_started",
      grade: null,
      late: false,
      latePenalty: 10,
    },
  ],
  math: [
    {
      id: "a-midterm",
      title: "Midterm",
      dueDate: "2026-05-02",
      weight: 25,
      status: "completed",
      grade: 81.7,
      late: false,
      latePenalty: 10,
    },
    {
      id: "a-problem-set",
      title: "Problem set",
      dueDate: "2026-05-09",
      weight: 15,
      status: "in_progress",
      grade: null,
      late: false,
      latePenalty: 10,
    },
    {
      id: "a-final",
      title: "Final",
      dueDate: "2026-06-04",
      weight: 60,
      status: "not_started",
      grade: null,
      late: false,
      latePenalty: 10,
    },
  ],
};

function universityState(school = "uoft") {
  const folders = universityFolders();
  return {
    courses: [
      {
        id: "course-civ",
        name: "CIV_344",
        assignments: assignments.bridge,
        color: "#0ea5e9",
        folderId: "year-1-fall",
        creditWeight: 0.5,
        gradeMode: "graded",
        includeInGpa: true,
      },
      {
        id: "course-mat",
        name: "MAT 186",
        assignments: assignments.math,
        color: "#22c55e",
        folderId: "year-1-winter",
        creditWeight: 0.5,
        gradeMode: "graded",
        includeInGpa: true,
      },
      {
        id: "course-cog",
        name: "COG260",
        assignments: [
          {
            id: "a-cog-paper",
            title: "Research brief",
            dueDate: "2026-05-21",
            weight: 40,
            status: "in_progress",
            grade: 91,
            late: false,
            latePenalty: 10,
          },
          {
            id: "a-cog-final",
            title: "Final reflection",
            dueDate: "2026-06-10",
            weight: 60,
            status: "not_started",
            grade: null,
            late: false,
            latePenalty: 10,
          },
        ],
        color: "#8b5cf6",
        folderId: "year-2-fall",
        creditWeight: 0.5,
        gradeMode: "graded",
        includeInGpa: true,
      },
    ],
    folders,
    appMode: "university",
    calendarTheme: "academic",
    universityThemeId: school,
    customThemeId: "classic",
  };
}

function customState() {
  return {
    courses: [
      {
        id: "custom-portfolio",
        name: "Portfolio Lab",
        assignments: [
          {
            id: "custom-wireframes",
            title: "Wireframes",
            dueDate: "2026-05-07",
            weight: 20,
            status: "completed",
            grade: 94,
            late: false,
            latePenalty: 10,
          },
          {
            id: "custom-case-study",
            title: "Case study",
            dueDate: "2026-05-19",
            weight: 45,
            status: "in_progress",
            grade: null,
            late: false,
            latePenalty: 10,
          },
          {
            id: "custom-demo",
            title: "Demo day",
            dueDate: "2026-06-01",
            weight: 35,
            status: "not_started",
            grade: null,
            late: false,
            latePenalty: 10,
          },
        ],
        color: "#14b8a6",
        folderId: "custom-sprint",
        creditWeight: 0.5,
        gradeMode: "graded",
        includeInGpa: true,
      },
      {
        id: "custom-exam",
        name: "Exam Sprint",
        assignments: [
          {
            id: "custom-review",
            title: "Review set",
            dueDate: "2026-05-12",
            weight: 40,
            status: "completed",
            grade: 87,
            late: false,
            latePenalty: 10,
          },
          {
            id: "custom-final",
            title: "Final push",
            dueDate: "2026-06-08",
            weight: 60,
            status: "not_started",
            grade: null,
            late: false,
            latePenalty: 10,
          },
        ],
        color: "#f59e0b",
        folderId: "custom-exams",
        creditWeight: 0.5,
        gradeMode: "graded",
        includeInGpa: true,
      },
    ],
    folders: [
      {id: "custom-sprint", name: "Launch Sprint", year: "Personal", color: "#14b8a6", collapsed: false},
      {id: "custom-exams", name: "Exam Season", year: "Personal", color: "#f59e0b", collapsed: false},
      {id: "custom-side", name: "Side Quest", year: "Personal", color: "#8b5cf6", collapsed: false},
    ],
    appMode: "custom",
    calendarTheme: "deadline",
    universityThemeId: "uoft",
    customThemeId: "neon",
  };
}

async function ensureServer() {
  try {
    const response = await fetch(baseUrl);
    if (response.ok) return null;
  } catch {
    // Start the dev server below.
  }

  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev", "--", "--port", "5173"], {
    cwd: root,
    stdio: "ignore",
    detached: false,
  });

  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return child;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  child.kill();
  throw new Error("Timed out waiting for Vite dev server.");
}

async function newSeededPage(browser, state, viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: viewport.width <= 500 ? 2 : 1,
    isMobile: viewport.width <= 500,
    hasTouch: viewport.width <= 500,
  });
  await context.addInitScript((seedState) => {
    window.localStorage.setItem(
      "course-tracker-v1",
      JSON.stringify({state: seedState, version: 0})
    );
  }, state);
  const page = await context.newPage();
  await page.goto(baseUrl, {waitUntil: "networkidle"});
  await page.waitForSelector("text=MarkMate", {timeout: 15000});
  if (state.courses?.[0]?.name) {
    await page.waitForSelector(`text=${state.courses[0].name}`, {timeout: 15000}).catch(() => {});
  }
  await page.waitForTimeout(900);
  return {context, page};
}

async function screenshot(page, fileName) {
  await page.screenshot({path: join(outDir, fileName), fullPage: false});
}

async function clickIfVisible(page, selector) {
  const locator = page.locator(selector);
  if ((await locator.count()) > 0 && (await locator.first().isVisible())) {
    await locator.first().click();
    await page.waitForTimeout(350);
    return true;
  }
  return false;
}

async function main() {
  mkdirSync(outDir, {recursive: true});
  const server = await ensureServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromium.executablePath(),
  });

  try {
    {
      const {context, page} = await newSeededPage(browser, universityState("uoft"), {
        width: 1440,
        height: 900,
      });
      await clickIfVisible(page, "text=Use university mode");
      await page.waitForTimeout(600);
      await screenshot(page, "desktop-dashboard-actual.png");
      await clickIfVisible(page, "text=Calendar");
      await screenshot(page, "desktop-calendar-actual.png");
      await clickIfVisible(page, "text=Dashboard");
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      if ((await searchInput.count()) > 0) {
        await searchInput.fill("MAT");
        await page.waitForTimeout(250);
        await screenshot(page, "desktop-search-actual.png");
      } else {
        await screenshot(page, "desktop-search-actual.png");
      }
      await context.close();
    }

    {
      const {context, page} = await newSeededPage(browser, customState(), {
        width: 1440,
        height: 900,
      });
      await screenshot(page, "desktop-custom-actual.png");
      await context.close();
    }

    {
      const {context, page} = await newSeededPage(browser, universityState("uoft"), {
        width: 390,
        height: 844,
      });
      await screenshot(page, "mobile-home-actual.png");
      await page.getByRole("button", {name: "Courses", exact: true}).click();
      await page.waitForTimeout(350);
      await screenshot(page, "mobile-courses-actual.png");
      await page.getByText("Y1 Fall", {exact: true}).click();
      await page.waitForTimeout(350);
      await screenshot(page, "mobile-semester-actual.png");
      await page.getByText("CIV_344", {exact: true}).click();
      await page.waitForTimeout(450);
      await screenshot(page, "mobile-course-actual.png");
      await page.getByText("Need to pass?", {exact: true}).click();
      await page.waitForTimeout(450);
      await screenshot(page, "mobile-pass-actual.png");
      await context.close();
    }

    {
      const {context, page} = await newSeededPage(browser, universityState("uoft"), {
        width: 390,
        height: 844,
      });
      await page.getByRole("button", {name: "GPA", exact: true}).click();
      await page.waitForTimeout(400);
      await screenshot(page, "mobile-gpa-actual.png");
      await context.close();
    }

    {
      const {context, page} = await newSeededPage(browser, customState(), {
        width: 390,
        height: 844,
      });
      await screenshot(page, "mobile-custom-actual.png");
      await page.getByRole("button", {name: "Courses", exact: true}).click();
      await page.waitForTimeout(350);
      await screenshot(page, "mobile-custom-courses-actual.png");
      await context.close();
    }

    for (const school of schools) {
      const {context, page} = await newSeededPage(browser, universityState(school), {
        width: 390,
        height: 844,
      });
      await screenshot(page, `school-${school}-actual.png`);
      await context.close();
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
