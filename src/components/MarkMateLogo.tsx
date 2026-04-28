type MarkMateLogoProps = {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  xs: "h-6 w-6 rounded-lg text-[0.55rem]",
  sm: "h-9 w-9 rounded-xl text-[0.7rem]",
  md: "h-12 w-12 rounded-2xl text-sm",
  lg: "h-16 w-16 rounded-[1.35rem] text-base",
};

export function MarkMateLogo({
  size = "md",
  className = "",
}: MarkMateLogoProps) {
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden bg-slate-950 font-black tracking-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_34px_-24px_rgba(15,23,42,0.72)] ring-1 ring-white/20 ${sizeClass[size]} ${className}`}
      aria-hidden="true"
    >
      <span className="absolute -left-3 top-1 h-8 w-8 rounded-full bg-rose-400/80 blur-[1px]" />
      <span className="absolute -bottom-4 right-0 h-9 w-9 rounded-full bg-emerald-400/80 blur-[1px]" />
      <span className="relative flex items-baseline gap-[1px]">
        <span>M</span>
        <span className="text-emerald-200">M</span>
      </span>
    </span>
  );
}
