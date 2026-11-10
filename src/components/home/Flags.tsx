// Hand-drawn SVG national flags (3:2 frame). Official flag colours are part of the artwork,
// so they are set as SVG fills here rather than theme tokens.
import type { ReactElement } from "react";

const W = 30;
const H = 20;

function India() {
  const spokes = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <>
      <rect width={W} height={H} fill="#FFFFFF" />
      <rect width={W} height={H / 3} fill="#FF9933" />
      <rect y={(H / 3) * 2} width={W} height={H / 3} fill="#138808" />
      <g transform={`translate(${W / 2} ${H / 2})`} stroke="#000080" fill="none">
        <circle r={2.9} strokeWidth={0.35} />
        <circle r={0.45} fill="#000080" stroke="none" />
        {spokes.map((a) => (
          <line key={a} x1={0} y1={0} x2={0} y2={-2.8} strokeWidth={0.12} transform={`rotate(${a})`} />
        ))}
      </g>
    </>
  );
}

function SouthKorea() {
  const ang = (Math.atan2(2, 3) * 180) / Math.PI; // diagonal of a 3:2 flag
  // Trigrams: true = solid bar, false = broken bar (inner → outer)
  const trigrams: [number, boolean[]][] = [
    [180 + ang, [true, true, true]], // geon – top left
    [-ang, [false, true, false]], // gam – top right
    [180 - ang, [true, false, true]], // ri – bottom left
    [ang, [false, false, false]], // gon – bottom right
  ];
  return (
    <>
      <rect width={W} height={H} fill="#FFFFFF" />
      <g transform={`translate(${W / 2} ${H / 2}) rotate(${ang})`}>
        <path d="M-5 0 A5 5 0 0 1 5 0 Z" fill="#CD2E3A" />
        <path d="M-5 0 A5 5 0 0 0 5 0 Z" fill="#0047A0" />
        <circle cx={-2.5} cy={0} r={2.5} fill="#CD2E3A" />
        <circle cx={2.5} cy={0} r={2.5} fill="#0047A0" />
      </g>
      {trigrams.map(([rot, bars]) => (
        <g key={rot} transform={`translate(${W / 2} ${H / 2}) rotate(${rot})`} fill="#000000">
          {bars.map((solid, i) => {
            const x = 6.6 + i * 1.25;
            return solid ? (
              <rect key={i} x={x} y={-2.5} width={0.85} height={5} />
            ) : (
              <g key={i}>
                <rect x={x} y={-2.5} width={0.85} height={2.2} />
                <rect x={x} y={0.3} width={0.85} height={2.2} />
              </g>
            );
          })}
        </g>
      ))}
    </>
  );
}

function Spain() {
  return (
    <>
      <rect width={W} height={H} fill="#AA151B" />
      <rect y={H / 4} width={W} height={H / 2} fill="#F1BF00" />
    </>
  );
}

function Brazil() {
  return (
    <>
      <defs>
        <clipPath id="br-globe"><circle cx={15} cy={10} r={4.6} /></clipPath>
      </defs>
      <rect width={W} height={H} fill="#009C3B" />
      <path d="M2.4 10 L15 2 L27.6 10 L15 18 Z" fill="#FFDF00" />
      <circle cx={15} cy={10} r={4.6} fill="#002776" />
      <path d="M9.6 9.1 Q15 7.4 20.6 11.2" stroke="#FFFFFF" strokeWidth={0.75} fill="none" clipPath="url(#br-globe)" />
      {[[13, 12.4], [16.5, 12.8], [14.6, 13.6], [17.6, 11.6], [12.2, 11.2]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={0.22} fill="#FFFFFF" />
      ))}
    </>
  );
}

function Germany() {
  return (
    <>
      <rect width={W} height={H / 3} fill="#000000" />
      <rect y={H / 3} width={W} height={H / 3} fill="#DD0000" />
      <rect y={(H / 3) * 2} width={W} height={H / 3} fill="#FFCE00" />
    </>
  );
}

function UnitedStates() {
  const s = H / 13;
  const cantonW = 12.4;
  const cantonH = s * 7;
  const stars: [number, number][] = [];
  for (let r = 0; r < 9; r++) {
    const n = r % 2 === 0 ? 6 : 5;
    for (let c = 0; c < n; c++) {
      const x = (cantonW / 12) * (r % 2 === 0 ? 1 + c * 2 : 2 + c * 2);
      const y = (cantonH / 10) * (r + 1);
      stars.push([x, y]);
    }
  }
  return (
    <>
      <rect width={W} height={H} fill="#FFFFFF" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} y={i * 2 * s} width={W} height={s} fill="#B22234" />
      ))}
      <rect width={cantonW} height={cantonH} fill="#3C3B6E" />
      {stars.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={0.32} fill="#FFFFFF" />
      ))}
    </>
  );
}

const flags: Record<string, () => ReactElement> = {
  IN: India, KR: SouthKorea, ES: Spain, BR: Brazil, DE: Germany, US: UnitedStates,
};

export function Flag({ code, title, className }: { code: string; title: string; className?: string }) {
  const Art = flags[code];
  if (!Art) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Flag of ${title}`} className={className} preserveAspectRatio="xMidYMid slice">
      <Art />
    </svg>
  );
}
