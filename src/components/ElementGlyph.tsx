import { ELEMENTS } from '../data/elements';
import type { ElementId } from '../game/types';

interface Props {
  el: ElementId;
  size?: number;
}

export function ElementGlyph({ el, size = 18 }: Props) {
  const e = ELEMENTS[el];
  const s = size;
  const stroke = '#fff';
  let shape: React.ReactNode = null;

  if (el === 'ember') {
    shape = <path d={`M ${s/2} 2 Q ${s-2} ${s/2} ${s/2} ${s-2} Q 2 ${s/2} ${s/2} 2 Z`} fill={stroke} />;
  } else if (el === 'tide') {
    shape = <path d={`M 2 ${s*0.55} Q ${s/4} ${s*0.35} ${s/2} ${s*0.55} T ${s-2} ${s*0.55}`} stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" />;
  } else if (el === 'bloom') {
    shape = (
      <g fill={stroke}>
        <circle cx={s/2} cy={s*0.3} r={s*0.18} />
        <circle cx={s*0.28} cy={s*0.6} r={s*0.18} />
        <circle cx={s*0.72} cy={s*0.6} r={s*0.18} />
        <circle cx={s/2} cy={s*0.55} r={s*0.12} fill={e.deep} />
      </g>
    );
  } else if (el === 'gust') {
    shape = (
      <g stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round">
        <path d={`M 2 ${s*0.35} Q ${s*0.6} ${s*0.35} ${s*0.65} ${s*0.5} Q ${s*0.6} ${s*0.65} ${s*0.4} ${s*0.65}`} />
        <path d={`M 2 ${s*0.7} L ${s*0.55} ${s*0.7}`} />
      </g>
    );
  } else if (el === 'void') {
    shape = (
      <g>
        <circle cx={s/2} cy={s/2} r={s*0.32} fill="none" stroke={stroke} strokeWidth="2" />
        <circle cx={s/2} cy={s/2} r={s*0.12} fill={stroke} />
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
