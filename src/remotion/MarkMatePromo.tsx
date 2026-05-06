import type {CSSProperties, ReactNode} from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";

const cap = (name: string) => staticFile(`remotion-captures/${name}`);
const asset = (name: string) => staticFile(`remotion-assets/${name}`);
const totalFrames = 1440;

const schools = [
  ["uoft", "U of T"],
  ["western", "Western"],
  ["queens", "Queen's"],
  ["york", "York"],
  ["tmu", "TMU"],
  ["waterloo", "Waterloo"],
  ["laurier", "Laurier"],
  ["brock", "Brock"],
  ["guelph", "Guelph"],
  ["uottawa", "uOttawa"],
  ["mcgill", "McGill"],
] as const;

const scenes = [
  {
    start: 0,
    end: 105,
    kicker: "MarkMate",
    title: "Meet the grade tracker built for real semesters.",
    body: "Courses, deadlines, GPA, and what-you-need-to-pass math in one app.",
  },
  {
    start: 105,
    end: 255,
    kicker: "Start with your school",
    title: "Pick your university. MarkMate loads the structure.",
    body: "School mode gives you the right years, semesters, theme, and GPA setup.",
  },
  {
    start: 255,
    end: 435,
    kicker: "Phone walkthrough",
    title: "Move through the app like a student actually would.",
    body: "Home to courses, semester, then the exact class you are tracking.",
  },
  {
    start: 435,
    end: 610,
    kicker: "Course tracking",
    title: "Every class gets weights, marks, and grade progress.",
    body: "Track assignments as they come in and see what is still affecting the final mark.",
  },
  {
    start: 610,
    end: 785,
    kicker: "Need to pass",
    title: "Tell it what is left. It tells you the score you need.",
    body: "No spreadsheet panic before finals. MarkMate does the remaining-grade math.",
  },
  {
    start: 785,
    end: 960,
    kicker: "Desktop mode",
    title: "Plan faster on desktop. Check it anywhere on phone.",
    body: "Use the wider view for courses, calendar planning, and upcoming deadlines.",
  },
  {
    start: 960,
    end: 1130,
    kicker: "Canadian GPA",
    title: "Built-in GPA calculators for 11 schools across Canada.",
    body: "The calculator changes with the school you choose, from U of T to McGill.",
  },
  {
    start: 1130,
    end: 1285,
    kicker: "Custom mode",
    title: "Not in university? Build your own system.",
    body: "Create your own terms, courses, weights, deadlines, and progress tracking.",
  },
  {
    start: 1285,
    end: totalFrames,
    kicker: "MarkMate",
    title: "Track smarter. Stress less.",
    body: "A smoother way to know where you stand before the semester gets loud.",
  },
] as const;

type Scene = (typeof scenes)[number];

function activeScene(frame: number): Scene {
  let current: Scene = scenes[0];
  for (const scene of scenes) {
    if (frame >= scene.start) current = scene;
  }
  return current;
}

function sceneOpacity(frame: number, start: number, end: number, fade = 14) {
  return interpolate(frame, [start, start + fade, end - fade, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function pop(frame: number, start: number, damping = 16) {
  return spring({
    frame: frame - start,
    fps: 30,
    config: {damping, stiffness: 150, mass: 0.72},
  });
}

function Logo({size = 78}: {size?: number}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        display: "grid",
        placeItems: "center",
        color: "#fff",
        fontSize: size * 0.42,
        fontWeight: 1000,
        letterSpacing: -size * 0.07,
        background: "linear-gradient(135deg, #18212a 0%, #18212a 58%, #5fbe96 100%)",
        boxShadow: "0 22px 55px rgba(24, 33, 42, .24), inset 0 0 0 2px rgba(255,255,255,.18)",
      }}
    >
      MM
    </div>
  );
}

function Background() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(154deg, #f7f8f5 0%, #eef2ef 58%, #dfe8e4 100%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -120,
          backgroundImage:
            "linear-gradient(rgba(24,33,42,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(24,33,42,.055) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          transform: `translate(${(frame * -0.45) % 64}px, ${(frame * 0.32) % 64}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -170,
          top: 120,
          width: 540,
          height: 1380,
          transform: "rotate(-10deg)",
          background: "linear-gradient(180deg, rgba(95,190,150,.18), rgba(255,255,255,.14))",
          border: "1px solid rgba(24,33,42,.06)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -230,
          top: 555,
          width: 620,
          height: 720,
          transform: "rotate(16deg)",
          background: "linear-gradient(135deg, rgba(255,255,255,.42), rgba(24,33,42,.035))",
          border: "1px solid rgba(24,33,42,.055)",
        }}
      />
    </AbsoluteFill>
  );
}

function SceneCopy() {
  const frame = useCurrentFrame();
  const scene = activeScene(frame);
  const p = pop(frame, scene.start, 14);
  const longTitle = scene.title.length > 48;

  return (
    <div
      style={{
        position: "absolute",
        left: 64,
        right: 64,
        top: 58,
        zIndex: 20,
        color: "#18212a",
      }}
    >
      <div style={{display: "flex", alignItems: "center", gap: 18, marginBottom: 30}}>
        <Logo />
        <div>
          <div style={{fontSize: 32, fontWeight: 1000, letterSpacing: 6, color: "#18212a"}}>
            MARKMATE
          </div>
          <div style={{fontSize: 24, fontWeight: 900, color: "#3f8f70"}}>{scene.kicker}</div>
        </div>
      </div>
      <div
        style={{
          maxWidth: 920,
          fontSize: longTitle ? 61 : 70,
          lineHeight: 0.96,
          fontWeight: 1000,
          letterSpacing: -3,
          textShadow: "0 18px 46px rgba(255,255,255,.5)",
          opacity: interpolate(p, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(p, [0, 1], [28, 0])}px)`,
        }}
      >
        {scene.title}
      </div>
      <div
        style={{
          marginTop: 24,
          maxWidth: 850,
          fontSize: 30,
          lineHeight: 1.18,
          fontWeight: 850,
          color: "#4a5760",
          opacity: interpolate(p, [0, 1], [0, 1]),
        }}
      >
        {scene.body}
      </div>
    </div>
  );
}

function PhoneFrame({
  src,
  start,
  style,
  children,
  objectPosition = "top center",
}: {
  src: string;
  start: number;
  style?: CSSProperties;
  children?: ReactNode;
  objectPosition?: CSSProperties["objectPosition"];
}) {
  const frame = useCurrentFrame();
  const p = pop(frame, start);
  return (
    <div
      style={{
        position: "absolute",
        left: 307,
        top: 565,
        width: 466,
        height: 1008,
        borderRadius: 76,
        padding: 14,
        background: "linear-gradient(145deg, #18212a, #38424b)",
        boxShadow: "0 52px 120px rgba(24,33,42,.28), inset 0 0 0 2px rgba(255,255,255,.16)",
        overflow: "hidden",
        transform: `translateY(${interpolate(p, [0, 1], [92, 0])}px) scale(${interpolate(p, [0, 1], [0.92, 1])})`,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 172,
          top: 24,
          width: 122,
          height: 30,
          borderRadius: 999,
          background: "#111820",
          zIndex: 5,
        }}
      />
      <div style={{position: "relative", height: "100%", borderRadius: 62, overflow: "hidden", background: "#f8fafc"}}>
        <Img
          src={cap(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition,
          }}
        />
        {children}
      </div>
    </div>
  );
}

function DesktopFrame({
  src,
  start,
  style,
  objectPosition = "top left",
}: {
  src: string;
  start: number;
  style?: CSSProperties;
  objectPosition?: CSSProperties["objectPosition"];
}) {
  const frame = useCurrentFrame();
  const p = pop(frame, start, 18);
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        top: 670,
        width: 940,
        height: 588,
        borderRadius: 32,
        padding: 10,
        background: "linear-gradient(145deg, rgba(255,255,255,.96), rgba(218,232,243,.86))",
        boxShadow: "0 48px 115px rgba(24,33,42,.22), inset 0 0 0 1px rgba(255,255,255,.8)",
        overflow: "hidden",
        transform: `translateY(${interpolate(p, [0, 1], [90, 0])}px) scale(${interpolate(p, [0, 1], [0.94, 1])})`,
        ...style,
      }}
    >
      <div
        style={{
          height: 30,
          display: "flex",
          gap: 8,
          alignItems: "center",
          paddingLeft: 14,
          background: "#edf5fb",
          borderRadius: "22px 22px 0 0",
        }}
      >
        {["#ff4d6d", "#ffd166", "#06d6a0"].map((color) => (
          <span key={color} style={{width: 10, height: 10, borderRadius: 999, background: color}} />
        ))}
      </div>
      <div style={{height: 538, overflow: "hidden", borderRadius: "0 0 22px 22px"}}>
        <Img src={cap(src)} style={{width: "100%", height: "100%", objectFit: "cover", objectPosition}} />
      </div>
    </div>
  );
}

function TapPulse({
  x,
  y,
  label,
  start,
}: {
  x: number;
  y: number;
  label: string;
  start: number;
}) {
  const frame = useCurrentFrame();
  const rel = frame - start;
  const opacity = interpolate(rel, [0, 8, 34, 42], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(Math.sin(Math.max(0, rel) * 0.38), [-1, 1], [0.92, 1.14]);
  return (
    <div style={{position: "absolute", left: x, top: y, zIndex: 15, opacity}}>
      <div
        style={{
          position: "absolute",
          left: -22,
          top: -22,
          width: 44,
          height: 44,
          borderRadius: 999,
          border: "5px solid #5fbe96",
          boxShadow: "0 0 0 12px rgba(95,190,150,.16)",
          transform: `scale(${scale})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 28,
          top: -28,
          whiteSpace: "nowrap",
          borderRadius: 999,
          padding: "12px 16px",
          background: "#18212a",
          color: "white",
          fontSize: 22,
          fontWeight: 950,
          boxShadow: "0 18px 45px rgba(24,33,42,.22)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function InfoCard({
  children,
  start,
  style,
  accent = "#5fbe96",
}: {
  children: ReactNode;
  start: number;
  style?: CSSProperties;
  accent?: string;
}) {
  const frame = useCurrentFrame();
  const p = pop(frame, start, 13);
  return (
    <div
      style={{
        position: "absolute",
        left: 64,
        right: 64,
        bottom: 170,
        borderRadius: 30,
        padding: "24px 28px",
        background: "rgba(255,255,255,.92)",
        color: "#18212a",
        fontSize: 31,
        lineHeight: 1.14,
        fontWeight: 950,
        border: "1px solid rgba(24,33,42,.08)",
        borderLeft: `9px solid ${accent}`,
        boxShadow: "0 34px 90px rgba(24,33,42,.16)",
        transform: `translateY(${interpolate(p, [0, 1], [52, 0])}px) scale(${interpolate(p, [0, 1], [0.94, 1])})`,
        opacity: interpolate(p, [0, 1], [0, 1]),
        zIndex: 25,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function IntroScene() {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, 0, 105);
  return (
    <AbsoluteFill style={{opacity}}>
      <PhoneFrame src="mobile-home-actual.png" start={10} style={{top: 620}} />
      <InfoCard start={38} accent="#ffffff" style={{bottom: 145}}>
        Built for the question every student checks: am I okay, and what do I need next?
      </InfoCard>
    </AbsoluteFill>
  );
}

function SchoolSetupScene() {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, 105, 255);
  return (
    <AbsoluteFill style={{opacity}}>
      <PhoneFrame src="mobile-home-actual.png" start={116} style={{top: 590}} />
      <TapPulse x={302} y={208} start={140} label="School mode" />
      <InfoCard start={170}>
        Choose a supported school and MarkMate starts with real semesters, course flow, and GPA logic.
      </InfoCard>
    </AbsoluteFill>
  );
}

function PhoneWalkthroughScene() {
  const frame = useCurrentFrame();
  const start = 255;
  const opacity = sceneOpacity(frame, start, 435);
  const rel = frame - start;
  const step =
    rel < 55
      ? 0
      : rel < 105
        ? 1
        : rel < 152
          ? 2
          : 3;
  const screens = [
    "mobile-home-actual.png",
    "mobile-courses-actual.png",
    "mobile-semester-actual.png",
    "mobile-course-actual.png",
  ];

  return (
    <AbsoluteFill style={{opacity}}>
      <PhoneFrame src={screens[step]} start={start + 8} style={{top: 550}}>
        <TapPulse x={184} y={935} start={start + 20} label="Tap Courses" />
        <TapPulse x={230} y={470} start={start + 77} label="Open Y1 Fall" />
        <TapPulse x={236} y={612} start={start + 126} label="Open CIV 344" />
      </PhoneFrame>
      <InfoCard start={start + 80}>
        Tap through courses, semesters, individual classes, and the marks that actually decide your grade.
      </InfoCard>
    </AbsoluteFill>
  );
}

function CourseTrackingScene() {
  const frame = useCurrentFrame();
  const start = 435;
  const opacity = sceneOpacity(frame, start, 610);
  const pinBase: CSSProperties = {
    position: "absolute",
    borderRadius: 999,
    padding: "15px 20px",
    background: "#18212a",
    color: "white",
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 950,
    boxShadow: "0 20px 55px rgba(24,33,42,.22)",
    zIndex: 18,
  };

  return (
    <AbsoluteFill style={{opacity}}>
      <PhoneFrame src="mobile-course-actual.png" start={start + 10} style={{top: 548}} />
      <div style={{...pinBase, left: 92, top: 850}}>Assignment weights</div>
      <div style={{...pinBase, right: 86, top: 1010, background: "#30414a"}}>Current mark</div>
      <div style={{...pinBase, left: 92, top: 1170, background: "#3f8f70"}}>Grade so far</div>
      <InfoCard start={start + 76}>
        Add each assessment, set the weight, and MarkMate shows how the class is moving.
      </InfoCard>
    </AbsoluteFill>
  );
}

function NeedPassScene() {
  const frame = useCurrentFrame();
  const start = 610;
  const opacity = sceneOpacity(frame, start, 785);
  return (
    <AbsoluteFill style={{opacity}}>
      <PhoneFrame src="mobile-pass-actual.png" start={start + 10} style={{top: 530, width: 500, height: 1081, left: 290}} />
      <InfoCard start={start + 70}>
        Select the work still left in the course. MarkMate calculates the score you need to pass.
      </InfoCard>
      <div
        style={{
          position: "absolute",
          left: 92,
          top: 660,
          width: 285,
          borderRadius: 28,
          padding: "23px 25px",
          background: "#18212a",
          color: "white",
          fontSize: 34,
          lineHeight: 1.02,
          fontWeight: 1000,
          boxShadow: "0 28px 78px rgba(24,33,42,.28)",
        }}
      >
        Need about 40.5%
      </div>
    </AbsoluteFill>
  );
}

function DesktopPlanningScene() {
  const frame = useCurrentFrame();
  const start = 785;
  const opacity = sceneOpacity(frame, start, 960);
  const showCalendar = frame >= start + 86;
  return (
    <AbsoluteFill style={{opacity}}>
      <DesktopFrame
        src={showCalendar ? "desktop-calendar-actual.png" : "desktop-dashboard-actual.png"}
        start={showCalendar ? start + 86 : start + 8}
        style={{top: 670}}
      />
      {showCalendar && <TapPulse x={480} y={704} start={start + 88} label="Calendar view" />}
      <InfoCard start={start + 92}>
        Desktop gives you more room to plan, while the same system stays readable on mobile.
      </InfoCard>
    </AbsoluteFill>
  );
}

function GpaSchoolsScene() {
  const frame = useCurrentFrame();
  const start = 960;
  const opacity = sceneOpacity(frame, start, 1130);
  const index = Math.max(0, Math.floor((frame - start) / 15)) % schools.length;
  const [id, label] = schools[index];

  return (
    <AbsoluteFill style={{opacity}}>
      <PhoneFrame
        src={`school-${id}-actual.png`}
        start={start + 8}
        style={{left: 326, top: 552, width: 428, height: 926}}
      />
      <div
        style={{
          position: "absolute",
          left: 372,
          top: 1442,
          width: 336,
          borderRadius: 999,
          padding: "16px 18px",
          background: "#18212a",
          color: "white",
          textAlign: "center",
          fontSize: 32,
          fontWeight: 1000,
          boxShadow: "0 24px 60px rgba(24,33,42,.22)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 158,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "center",
          zIndex: 24,
        }}
      >
        {schools.map(([schoolId, schoolLabel]) => (
          <div
            key={schoolId}
            style={{
              borderRadius: 999,
              padding: "12px 17px",
              background: schoolId === id ? "#5fbe96" : "rgba(255,255,255,.92)",
              color: "#18212a",
              fontSize: 20,
              fontWeight: 950,
              boxShadow: "0 14px 34px rgba(24,33,42,.14)",
            }}
          >
            {schoolLabel}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

function CustomModeScene() {
  const frame = useCurrentFrame();
  const start = 1130;
  const opacity = sceneOpacity(frame, start, 1285);
  const showPhone = frame >= start + 76;
  return (
    <AbsoluteFill style={{opacity}}>
      {!showPhone && (
        <DesktopFrame src="desktop-custom-actual.png" start={start + 8} style={{top: 660}} />
      )}
      {showPhone && (
        <PhoneFrame src="mobile-custom-courses-actual.png" start={start + 82} style={{top: 548}} />
      )}
      <InfoCard start={start + 82}>
        Custom mode is for any class system: portfolio labs, bootcamps, exam prep, or personal study plans.
      </InfoCard>
    </AbsoluteFill>
  );
}

function FinalScene() {
  const frame = useCurrentFrame();
  const start = 1285;
  const opacity = sceneOpacity(frame, start, totalFrames, 18);
  const p = pop(frame, start + 12, 12);
  return (
    <AbsoluteFill
      style={{
        opacity,
        background: "linear-gradient(145deg, rgba(24,33,42,.96), rgba(36,48,54,.92))",
        color: "white",
        zIndex: 35,
      }}
    >
      <PhoneFrame src="mobile-home-actual.png" start={start + 20} style={{left: 337, top: 610, width: 406, height: 879}} />
      <div
        style={{
          position: "absolute",
          left: 76,
          right: 76,
          top: 100,
          textAlign: "center",
          transform: `scale(${interpolate(p, [0, 1], [0.9, 1])})`,
        }}
      >
        <div style={{display: "flex", justifyContent: "center", marginBottom: 28}}>
          <Logo size={92} />
        </div>
        <div style={{fontSize: 92, lineHeight: 0.9, fontWeight: 1000, letterSpacing: -5}}>
          Track smarter. Stress less.
        </div>
        <div style={{marginTop: 28, fontSize: 35, lineHeight: 1.16, fontWeight: 850, color: "#b8f5d7"}}>
          MarkMate keeps courses, deadlines, GPA, and pass planning in one smooth workspace.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          bottom: 165,
          borderRadius: 30,
          padding: "25px 30px",
          background: "linear-gradient(135deg, #ffffff, #dceee6)",
          color: "#18212a",
          textAlign: "center",
          fontSize: 34,
          lineHeight: 1.08,
          fontWeight: 1000,
          boxShadow: "0 34px 90px rgba(24,33,42,.24)",
        }}
      >
        Built for students who want to know exactly where they stand.
      </div>
    </AbsoluteFill>
  );
}

export function MarkMatePromo() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{fontFamily: "Geist, Satoshi, Outfit, ui-sans-serif, system-ui", overflow: "hidden"}}>
      <Background />
      <Audio src={asset("markmate-pulse.wav")} volume={0.74} />
      <IntroScene />
      <SchoolSetupScene />
      <PhoneWalkthroughScene />
      <CourseTrackingScene />
      <NeedPassScene />
      <DesktopPlanningScene />
      <GpaSchoolsScene />
      <CustomModeScene />
      <SceneCopy />
      <FinalScene />
      <div
        style={{
          position: "absolute",
          left: 58,
          right: 58,
          bottom: 48,
          height: 8,
          borderRadius: 999,
          background: "rgba(255,255,255,.22)",
          overflow: "hidden",
          zIndex: 60,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${interpolate(frame, [0, totalFrames], [0, 100])}%`,
            background: "linear-gradient(90deg, #5fbe96, #3f8f70)",
          }}
        />
      </div>
    </AbsoluteFill>
  );
}
