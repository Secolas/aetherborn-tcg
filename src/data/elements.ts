import type { ElementId } from '../game/types';

export interface ElementDef {
  name: string;
  color: string;
  deep: string;
  glow: string;
}

export const ELEMENTS: Record<ElementId, ElementDef> = {
  ember: { name: 'Ember', color: '#e8633a', deep: '#7a2a13', glow: '#ffb38a' },
  tide:  { name: 'Tide',  color: '#3a8fc4', deep: '#143b5e', glow: '#9ed6f7' },
  bloom: { name: 'Bloom', color: '#5ea863', deep: '#1f4524', glow: '#b9e3b8' },
  gust:  { name: 'Gust',  color: '#c8b46a', deep: '#5a4a1f', glow: '#f4e8a8' },
  void:  { name: 'Void',  color: '#7a4ea8', deep: '#2a163f', glow: '#c9a8e8' },
};

export const RARITY_COLOR: Record<string, string> = {
  common: '#9a958c',
  rare: '#5a8fc4',
  epic: '#a45ec8',
  legendary: '#e0a93a',
};

export const RARITY_WEIGHT: Record<string, number> = {
  common: 60,
  rare: 28,
  epic: 10,
  legendary: 2,
};
