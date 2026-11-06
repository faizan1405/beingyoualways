import type { ProductShape } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Replaceable vector placeholder for product photography.
 * Swap for real <img> assets once the client supplies product photos.
 */
export function ProductVisual({
  shape, tint, label, className, variant = 0,
}: { shape: ProductShape; tint: string; label: string; className?: string | undefined; variant?: number | undefined}) {
  const bgs = ["var(--secondary)", "oklch(0.93 0.02 60)", "oklch(0.92 0.02 140)", "oklch(0.95 0.01 20)"];
  return (
    <div
      role="img"
      aria-label={`${label} — placeholder product image`}
      className={cn("relative flex aspect-[4/5] items-center justify-center overflow-hidden", className)}
      style={{ background: bgs[variant % bgs.length] }}
    >
      <svg viewBox="0 0 200 250" className="h-[78%] w-auto drop-shadow-[0_18px_22px_oklch(0.3_0.03_150/0.18)]" aria-hidden>
        <ellipse cx="100" cy="232" rx="58" ry="7" fill="oklch(0.3 0.03 150 / 0.12)" />
        {/* botanical sprig */}
        <g opacity="0.55" stroke="var(--sage)" strokeWidth="2" fill="var(--sage)">
          <path d="M150 232 C150 190 160 160 175 130" fill="none" />
          <ellipse cx="166" cy="160" rx="11" ry="5" transform="rotate(-50 166 160)" />
          <ellipse cx="158" cy="190" rx="11" ry="5" transform="rotate(-30 158 190)" />
          <ellipse cx="172" cy="140" rx="9" ry="4" transform="rotate(-70 172 140)" />
        </g>
        <Shape shape={shape} tint={tint} />
      </svg>
      <span className="eyebrow absolute bottom-3 left-3 !text-[9px] opacity-70">Sample image</span>
    </div>
  );
}

function Shape({ shape, tint }: { shape: ProductShape; tint: string }) {
  const cap = "var(--primary)";
  const label = "oklch(0.98 0.006 88 / 0.9)";
  switch (shape) {
    case "jar":
      return (
        <g>
          <rect x="52" y="120" width="96" height="22" rx="6" fill={cap} />
          <rect x="46" y="140" width="108" height="88" rx="14" fill={tint} />
          <rect x="62" y="166" width="76" height="34" rx="3" fill={label} />
          <rect x="72" y="180" width="56" height="3" fill={cap} opacity=".6" />
        </g>
      );
    case "tube":
      return (
        <g>
          <path d="M68 40 H132 L124 200 H76 Z" fill={tint} />
          <rect x="74" y="200" width="52" height="30" rx="4" fill={cap} />
          <rect x="82" y="90" width="36" height="60" rx="2" fill={label} />
        </g>
      );
    case "dropper":
      return (
        <g>
          <rect x="90" y="40" width="20" height="38" rx="9" fill={cap} />
          <rect x="84" y="76" width="32" height="20" rx="3" fill={cap} />
          <rect x="66" y="96" width="68" height="132" rx="16" fill={tint} opacity=".92" />
          <rect x="78" y="140" width="44" height="50" rx="2" fill={label} />
        </g>
      );
    case "lipstick":
      return (
        <g>
          <path d="M84 60 L116 46 V110 H84 Z" fill={tint} />
          <rect x="80" y="108" width="40" height="28" rx="2" fill="oklch(0.78 0.06 80)" />
          <rect x="76" y="134" width="48" height="94" rx="4" fill={cap} />
        </g>
      );
    case "compact":
      return (
        <g>
          <ellipse cx="100" cy="190" rx="62" ry="22" fill={cap} />
          <rect x="38" y="160" width="124" height="30" fill={cap} />
          <ellipse cx="100" cy="160" rx="62" ry="22" fill={tint} />
          <ellipse cx="100" cy="160" rx="40" ry="13" fill="oklch(1 0 0 / 0.25)" />
        </g>
      );
    default:
      return (
        <g>
          <rect x="88" y="34" width="24" height="26" rx="3" fill={cap} />
          <rect x="80" y="58" width="40" height="16" rx="3" fill={cap} />
          <path d="M70 76 H130 Q142 76 142 92 V214 Q142 228 128 228 H72 Q58 228 58 214 V92 Q58 76 70 76Z" fill={tint} />
          <rect x="72" y="130" width="56" height="60" rx="2" fill={label} />
        </g>
      );
  }
}
