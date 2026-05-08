import { ELEMENTS } from '../data/elements';
import type { ElementId } from '../game/types';

interface Props {
  el: ElementId;
  size?: number;
}

/** Theme glyph: heart (family), briefcase (work), paw (animals). */
export function ElementGlyph({ el, size = 18 }: Props) {
  const e = ELEMENTS[el];
  const s = size;
  const stroke = '#fff';
  let shape: React.ReactNode = null;

  if (el === 'family') {
    // Heart
    shape = (
      <path
        d={`M ${s/2} ${s*0.82} C ${s*0.08} ${s*0.55} ${s*0.06} ${s*0.22} ${s*0.3} ${s*0.18} Q ${s*0.42} ${s*0.18} ${s/2} ${s*0.32} Q ${s*0.58} ${s*0.18} ${s*0.7} ${s*0.18} C ${s*0.94} ${s*0.22} ${s*0.92} ${s*0.55} ${s/2} ${s*0.82} Z`}
        fill={stroke}
      />
    );
  } else if (el === 'work') {
    // Briefcase
    shape = (
      <g fill={stroke}>
        <rect x={s*0.16} y={s*0.4} width={s*0.68} height={s*0.42} rx={s*0.05} />
        <rect x={s*0.36} y={s*0.26} width={s*0.28} height={s*0.16} rx={s*0.03} fill="none" stroke={stroke} strokeWidth={Math.max(1.4, s*0.08)} />
        <rect x={s*0.16} y={s*0.55} width={s*0.68} height={s*0.04} fill={e.deep} />
      </g>
    );
  } else if (el === 'animals') {
    // Paw print
    shape = (
      <g fill={stroke}>
        <ellipse cx={s/2} cy={s*0.66} rx={s*0.22} ry={s*0.18} />
        <ellipse cx={s*0.26} cy={s*0.42} rx={s*0.1} ry={s*0.13} />
        <ellipse cx={s*0.5} cy={s*0.3}  rx={s*0.1} ry={s*0.13} />
        <ellipse cx={s*0.74} cy={s*0.42} rx={s*0.1} ry={s*0.13} />
      </g>
    );
  }

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <circle cx={s/2} cy={s/2} r={s/2} fill={e.deep} />
      {shape}
    </svg>
  );
}
