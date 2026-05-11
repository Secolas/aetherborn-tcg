import { Heart, Briefcase, PawPrint, Plane, UtensilsCrossed } from 'lucide-react';
import { ELEMENTS } from '../data/elements';
import type { ElementId } from '../game/types';

interface Props {
  el: ElementId;
  size?: number;
  /** When true, render only the icon (no themed circle background). */
  bare?: boolean;
}

const ICON = {
  family:  Heart,
  work:    Briefcase,
  animals: PawPrint,
  travel:  Plane,
  food:    UtensilsCrossed,
} as const;

export function ElementGlyph({ el, size = 18, bare = false }: Props) {
  const e = ELEMENTS[el];
  const Icon = ICON[el];
  const iconSize = bare ? size : Math.round(size * 0.58);

  if (bare) {
    return <Icon size={iconSize} color={e.color} strokeWidth={2.2} fill={e.color} />;
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${e.color}, ${e.deep})`,
      display: 'grid', placeItems: 'center',
      boxShadow: `0 2px 4px ${e.deep}55`,
    }}>
      <Icon size={iconSize} color="#fff" strokeWidth={2.2} fill="#fff" />
    </div>
  );
}
