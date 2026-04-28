type MarkMateLogoProps = {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  xs: "h-6 w-6 rounded-lg",
  sm: "h-9 w-9 rounded-xl",
  md: "h-12 w-12 rounded-2xl",
  lg: "h-16 w-16 rounded-[1.35rem]",
};

export function MarkMateLogo({
  size = "md",
  className = "",
}: MarkMateLogoProps) {
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_34px_-24px_rgba(15,23,42,0.72)] ring-1 ring-white/20 ${sizeClass[size]} ${className}`}
      aria-hidden="true"
      style={{
        background:
          "linear-gradient(145deg, #020617 0%, color-mix(in srgb, var(--theme-primary, #0f172a) 42%, #0f172a) 58%, #111827 100%)",
      }}
    >
      <span
        className="absolute inset-x-0 bottom-0 h-[18%]"
        style={{
          background:
            "linear-gradient(90deg, var(--theme-primary, #0ea5e9), var(--theme-accent, #38bdf8))",
        }}
      />
      <svg
        className="relative h-[70%] w-[70%]"
        viewBox="0 0 42 42"
        fill="none"
        role="img"
      >
        <path
          d="M7 31V11l7 8 7-8v20"
          stroke="currentColor"
          strokeWidth="4.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21 31V11l7 8 7-8v20"
          stroke="currentColor"
          strokeOpacity="0.76"
          strokeWidth="4.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13 32h16"
          stroke="var(--theme-accent, #38bdf8)"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
