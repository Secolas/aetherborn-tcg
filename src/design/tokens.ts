/**
 * Aetherborn design tokens — the canonical name for every semantic
 * color in the app. Every component should import from here instead of
 * hard-coding hex values, so the palette can shift in one place and
 * propagate everywhere.
 *
 * STAGE 1 of the color unification (see the "Color audit + unified
 * system" discussion). The constants here are mapped to the *current*
 * hex values used across the codebase, so this commit is a pure
 * refactor: zero visual change. Stage 2 will tighten the mapping by
 * collapsing near-duplicate hues (e.g. three different greens into
 * one OWNED green).
 *
 * ============================================================
 *  THE 8 FUNCTIONAL ROLES
 * ============================================================
 *
 *  BRAND      — primary CTA, sunset coral. The "go" color.
 *  SELECTION  — pale gold ring on hovered/selected things, bond pill.
 *  OWNED      — mint green. Player ownership, "yours", reward-ready.
 *  DAMAGE     — deep red. HP, damage popups, destructive actions.
 *  RESOURCE   — blue. Mana, deck count, "cold" statuses.
 *  SPELL      — violet. Spell-card chrome, silence (a spell effect).
 *  PREMIUM    — bright gold. Coins, legendary moments, premium cosmetics.
 *  NEUTRAL    — warm brown. Body text, dimmed/exhausted states.
 *
 *  Plus a fixed set of SURFACE tones (backgrounds, borders) and the
 *  four CARD RARITY tints. Element tints (Family/Work/Animals/...) live
 *  in src/data/elements.ts; those are foundational to card identity and
 *  intentionally outside the functional palette.
 */

// ---------------------------------------------------------------
// Functional roles
// ---------------------------------------------------------------

/** Primary CTA / brand. Sunset coral. */
export const BRAND       = '#ee5a52';
/** Lighter coral used at the top of CTA gradients. */
export const BRAND_LIGHT = '#ff7e5f';
/** Pressed / pre-darkest stop of CTA gradients. */
export const BRAND_DEEP  = '#e85d3c';

/** Pale gold — selection rings, bond pills, attack-ready pulse. */
export const SELECTION   = '#f4d04a';

/** Mint green — player ownership, bond-active link badge, reward-ready
 *  indicators (e.g. daily streak claim available). */
export const OWNED       = '#06d6a0';

/** Deep red — HP orbs, damage popups, destructive button stops. */
export const DAMAGE      = '#c8362e';

/** Mana / resource blue — mana chip, deck count, frozen status overlay. */
export const RESOURCE    = '#3a8fc4';

/** Spell violet — used on spell card chrome and silence status, both
 *  of which read as "mystical / spellwork". Stage 2 may collapse the
 *  existing duplicate `#7a4ea8` chrome here. */
export const SPELL       = '#a47bff';

/** Bright gold — coin currency, legendary halos, premium cosmetic
 *  unlock prompts. Distinct from SELECTION (more saturated, warmer). */
export const PREMIUM     = '#ffd166';
/** Warm amber companion for coin badges + premium gradients. */
export const PREMIUM_RIM = '#e8a93a';

// ---------------------------------------------------------------
// Surface neutrals
// ---------------------------------------------------------------

export const TEXT        = '#3a2e2a';
export const TEXT_MID    = '#7a5a52';
export const TEXT_LIGHT  = '#a89580';
export const PAPER       = '#ffffff';
export const BG          = '#fef8f0';
export const BG_WARM     = '#ffe8d6';
export const BG_PEACH    = '#ffd1b3';
export const BORDER      = 'rgba(58, 46, 42, 0.10)';

// ---------------------------------------------------------------
// Card rarity tints — wear on cards only, not UI chrome.
// ---------------------------------------------------------------

export const RARITY = {
  common:    '#9b8a78',
  rare:      '#4d8de2',  // cool, saturated — distinct from RESOURCE
  epic:      '#b585f0',  // lighter than SPELL violet
  legendary: PREMIUM,    // intentional: legendary IS premium
} as const;

// ---------------------------------------------------------------
// Convenience: a single object so consumers that currently import
// PALETTE keep working. styles.ts re-exports this as PALETTE; new
// code is encouraged to import individual tokens by name instead.
// ---------------------------------------------------------------

export const TOKENS = {
  // Brand
  BRAND, BRAND_LIGHT, BRAND_DEEP,
  // Functional
  SELECTION, OWNED, DAMAGE, RESOURCE, SPELL, PREMIUM, PREMIUM_RIM,
  // Surfaces
  TEXT, TEXT_MID, TEXT_LIGHT, PAPER, BG, BG_WARM, BG_PEACH, BORDER,
  // Rarity
  RARITY,
};
