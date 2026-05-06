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
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(255,255,255,0.08),0_18px_34px_-24px_rgba(15,23,42,0.72)] ring-1 ring-white/25 ${sizeClass[size]} ${className}`}
      aria-hidden="true"
      style={{
        background:
          "radial-gradient(circle at 22% 12%, color-mix(in srgb, var(--markmate-logo-accent, #34d399) 34%, transparent), transparent 34%), linear-gradient(145deg, color-mix(in srgb, var(--markmate-logo-primary, #8f5368) 52%, #0f172a) 0%, #111827 54%, color-mix(in srgb, var(--markmate-logo-accent, #34d399) 34%, #0f172a) 100%)",
      }}
    >
      <span
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 24% 12%, rgba(255,255,255,0.42), transparent 32%), linear-gradient(132deg, rgba(255,255,255,0.18), transparent 42%)",
        }}
      />
      <span
        className="absolute inset-[1px] rounded-[inherit]"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -1px 0 rgba(255,255,255,0.08)",
        }}
      />
      <span
        className="absolute inset-x-[16%] bottom-[12%] h-[8%] rounded-full"
        style={{
          background:
            "linear-gradient(90deg, var(--markmate-logo-primary, #fb7185), var(--markmate-logo-accent, #34d399))",
          boxShadow:
            "0 8px 18px -10px var(--markmate-logo-accent, #34d399)",
        }}
      />
      <svg
        className="relative h-[70%] w-[70%] drop-shadow-[0_10px_16px_rgba(2,6,23,0.22)]"
        viewBox="0 0 42 42"
        fill="none"
        role="img"
      >
        <path
          d="M7 31V11l7 8 7-8v20"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21 31V11l7 8 7-8v20"
          stroke="currentColor"
          strokeOpacity="0.76"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12.5 31.5c4.8 3 12.2 3 17 0"
          stroke="var(--markmate-logo-accent, #34d399)"
          strokeWidth="3.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
