import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const markmateGradient =
  "linear-gradient(135deg, #37aee2 0%, #30b987 52%, #d7a43a 100%)";

const steps = [
  "Open MarkMate in Safari",
  "Tap Share",
  "Add to Home Screen",
  "Confirm",
  "Launch like an app",
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function stepOpacity(frame: number, step: number) {
  return interpolate(frame, [step * 62 - 12, step * 62 + 8, step * 62 + 48, step * 62 + 66], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function MarkMateGlyph() {
  return (
    <div
      style={{
        width: 54,
        height: 54,
        borderRadius: 18,
        display: "grid",
        placeItems: "center",
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.22), rgba(255,255,255,0.04)), #0b1020",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.22), 0 20px 40px rgba(0,0,0,0.24)",
        color: "white",
        fontSize: 24,
        fontWeight: 900,
        letterSpacing: -2,
      }}
    >
      MM
    </div>
  );
}

function SafariScreen({ frame }: { frame: number }) {
  const shareY = interpolate(frame, [44, 72], [0, -78], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sheetOpacity = interpolate(frame, [58, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 22,
          borderRadius: 42,
          overflow: "hidden",
          background:
            "radial-gradient(circle at 20% 0%, rgba(255,255,255,0.72), transparent 26%), linear-gradient(135deg, #f8fafc, #e9f4ff)",
        }}
      >
        <div
          style={{
            height: 70,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 22px",
            background: "rgba(255,255,255,0.78)",
            borderBottom: "1px solid rgba(148,163,184,0.28)",
          }}
        >
          <div
            style={{
              flex: 1,
              height: 38,
              borderRadius: 20,
              background: "white",
              display: "flex",
              alignItems: "center",
              paddingLeft: 18,
              fontWeight: 800,
              color: "#475569",
              fontSize: 16,
            }}
          >
            markmate.app
          </div>
          <div style={{ fontSize: 28, color: "#2563eb" }}>^</div>
        </div>
        <div style={{ padding: 26 }}>
          <div
            style={{
              height: 176,
              borderRadius: 34,
              background: markmateGradient,
              padding: 2,
              boxShadow: "0 22px 60px rgba(14,165,233,0.24)",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 32,
                background: "rgba(15,23,42,0.9)",
                color: "white",
                padding: 24,
                display: "flex",
                alignItems: "center",
                gap: 18,
              }}
            >
              <MarkMateGlyph />
              <div>
                <div style={{ fontSize: 18, opacity: 0.62, fontWeight: 900 }}>
                  MARKMATE
                </div>
                <div style={{ fontSize: 42, fontWeight: 950, lineHeight: 1 }}>
                  Home
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 22,
              borderRadius: 34,
              background: "white",
              padding: 24,
              boxShadow: "0 22px 50px rgba(15,23,42,0.08)",
            }}
          >
            <div style={{ fontSize: 18, color: "#64748b", fontWeight: 900 }}>
              TODAY
            </div>
            <div style={{ marginTop: 18, height: 86, borderRadius: 26, background: markmateGradient }} />
            <div style={{ marginTop: 16, height: 56, borderRadius: 22, background: "#eef2f7" }} />
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 36,
          right: 36,
          bottom: 26,
          transform: `translateY(${shareY}px)`,
          opacity: sheetOpacity,
          borderRadius: 34,
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 28px 80px rgba(15,23,42,0.22)",
          padding: 18,
          backdropFilter: "blur(18px)",
        }}
      >
        {["Copy Link", "Add to Home Screen", "Save to Files"].map((label, index) => (
          <div
            key={label}
            style={{
              height: 50,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "0 16px",
              background: index === 1 ? "rgba(48,185,135,0.16)" : "transparent",
              color: index === 1 ? "#0f766e" : "#334155",
              fontSize: 18,
              fontWeight: 850,
            }}
          >
            <span>{index === 1 ? "+" : "o"}</span>
            {label}
          </div>
        ))}
      </div>
    </>
  );
}

function ConfirmScreen({ frame }: { frame: number }) {
  const scale = spring({ frame: frame - 130, fps: 30, config: { damping: 18 } });
  return (
    <div
      style={{
        position: "absolute",
        inset: 28,
        borderRadius: 44,
        background: "#f8fafc",
        padding: 30,
        transform: `scale(${0.96 + scale * 0.04})`,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 900, color: "#64748b" }}>
        Add to Home Screen
      </div>
      <div
        style={{
          marginTop: 30,
          borderRadius: 32,
          background: "white",
          padding: 22,
          display: "flex",
          alignItems: "center",
          gap: 18,
          boxShadow: "0 22px 50px rgba(15,23,42,0.1)",
        }}
      >
        <MarkMateGlyph />
        <div>
          <div style={{ fontSize: 30, fontWeight: 950, color: "#020617" }}>
            MarkMate
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#94a3b8" }}>
            markmate.app
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 32,
          top: 24,
          color: "#2563eb",
          fontSize: 24,
          fontWeight: 950,
        }}
      >
        Add
      </div>
    </div>
  );
}

function HomeScreen({ frame }: { frame: number }) {
  const appScale = spring({ frame: frame - 235, fps: 30, config: { damping: 18 } });
  return (
    <div
      style={{
        position: "absolute",
        inset: 22,
        borderRadius: 42,
        background:
          "radial-gradient(circle at 28% 8%, rgba(55,174,226,0.34), transparent 34%), radial-gradient(circle at 76% 74%, rgba(215,164,58,0.22), transparent 35%), #0b1020",
        padding: 30,
        color: "white",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 22,
          marginTop: 42,
        }}
      >
        {Array.from({ length: 11 }).map((_, index) => (
          <div
            key={index}
            style={{
              height: 62,
              borderRadius: 20,
              background: "rgba(255,255,255,0.16)",
            }}
          />
        ))}
        <div
          style={{
            transform: `scale(${0.86 + appScale * 0.14})`,
            transformOrigin: "center",
          }}
        >
          <MarkMateGlyph />
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 850, textAlign: "center" }}>
            MarkMate
          </div>
        </div>
      </div>
    </div>
  );
}

function AppLaunchScreen() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 22,
        borderRadius: 42,
        overflow: "hidden",
        background:
          "radial-gradient(circle at 14% 0%, rgba(55,174,226,0.36), transparent 42%), linear-gradient(135deg, #f8fafc, #edf8f3)",
      }}
    >
      <div style={{ padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <MarkMateGlyph />
          <div>
            <div style={{ fontSize: 17, fontWeight: 950, color: "#64748b" }}>
              MARKMATE
            </div>
            <div style={{ fontSize: 38, fontWeight: 950, color: "#020617" }}>
              Home
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 34,
            borderRadius: 36,
            background: markmateGradient,
            padding: 2,
          }}
        >
          <div
            style={{
              borderRadius: 34,
              background: "rgba(255,255,255,0.88)",
              padding: 26,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 950, color: "#64748b" }}>
              APP MODE
            </div>
            <div style={{ marginTop: 8, fontSize: 42, fontWeight: 950, color: "#020617" }}>
              No Safari bar.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InstallDemo() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneLift = spring({ frame, fps, config: { damping: 22 } });
  const tapX = interpolate(frame, [40, 70, 126, 164, 224, 252], [498, 498, 204, 520, 438, 438], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tapY = interpolate(frame, [40, 70, 126, 164, 224, 252], [1110, 1030, 826, 106, 728, 728], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tapPulse = 0.72 + 0.28 * Math.sin(frame / 6);

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 12% 4%, rgba(55,174,226,0.38), transparent 36%), radial-gradient(circle at 92% 80%, rgba(215,164,58,0.22), transparent 36%), linear-gradient(135deg, #06101e, #0f172a)",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 76,
          right: 76,
          top: 74,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "white",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 950 }}>MarkMate</div>
        <div style={{ fontSize: 18, fontWeight: 850, opacity: 0.58 }}>Install guide</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 76,
          right: 76,
          top: 132,
          height: 1030,
          borderRadius: 58,
          background: "linear-gradient(145deg, rgba(255,255,255,0.28), rgba(255,255,255,0.04))",
          padding: 10,
          transform: `translateY(${interpolate(phoneLift, [0, 1], [24, 0])}px)`,
          boxShadow: "0 50px 120px rgba(0,0,0,0.42)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 50,
            overflow: "hidden",
            background: "#020617",
          }}
        >
          <div style={{ opacity: stepOpacity(frame, 0) + stepOpacity(frame, 1) }}>
            <SafariScreen frame={frame} />
          </div>
          <div style={{ opacity: stepOpacity(frame, 2) + stepOpacity(frame, 3) }}>
            <ConfirmScreen frame={frame} />
          </div>
          <div style={{ opacity: stepOpacity(frame, 4) }}>
            {frame < 285 ? <HomeScreen frame={frame} /> : <AppLaunchScreen />}
          </div>

          <div
            style={{
              position: "absolute",
              left: clamp(tapX, 70, 570),
              top: clamp(tapY, 120, 1010),
              width: 52,
              height: 52,
              marginLeft: -26,
              marginTop: -26,
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              border: "2px solid rgba(255,255,255,0.72)",
              transform: `scale(${tapPulse})`,
              boxShadow: "0 0 0 12px rgba(55,174,226,0.14)",
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 76,
          right: 76,
          bottom: 74,
          height: 92,
          borderRadius: 32,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.08))",
          backdropFilter: "blur(18px)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          fontWeight: 950,
        }}
      >
        {steps[Math.min(steps.length - 1, Math.floor(frame / 62))]}
      </div>
    </AbsoluteFill>
  );
}
