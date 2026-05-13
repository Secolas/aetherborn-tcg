# `src/design/`

Single source of truth for the app's visual language.

## `tokens.ts`

Named semantic colors. Eight functional roles + surface neutrals +
rarity tints. Import the exact token your usage needs:

```ts
import { BRAND, OWNED, DAMAGE, SELECTION } from '../design/tokens';
```

### Quick reference

| Token         | Hex       | Role                                                |
|---------------|-----------|-----------------------------------------------------|
| `BRAND`       | `#ee5a52` | Primary CTA. The "go" color.                        |
| `BRAND_LIGHT` | `#ff7e5f` | Top of CTA gradients.                               |
| `BRAND_DEEP`  | `#e85d3c` | Pressed / bottom of CTA gradients.                  |
| `SELECTION`   | `#f4d04a` | Pale gold rings on selected/hovered; bond pill.     |
| `OWNED`       | `#06d6a0` | Mint. Player ownership, reward-ready badges.        |
| `DAMAGE`      | `#c8362e` | Deep red. HP, damage popups, destructive actions.   |
| `RESOURCE`    | `#3a8fc4` | Blue. Mana, deck count, "cold" statuses.            |
| `SPELL`       | `#a47bff` | Violet. Spell card chrome, silence status.          |
| `PREMIUM`     | `#ffd166` | Bright gold. Coins, legendary moments.              |
| `PREMIUM_RIM` | `#e8a93a` | Companion rim for coin badges + gold gradients.    |

Surface neutrals (`TEXT`, `TEXT_MID`, `TEXT_LIGHT`, `PAPER`, `BG`,
`BG_WARM`, `BG_PEACH`, `BORDER`) live in the same module.

### Migration status

**Stage 1 (done):** Tokens defined, `PALETTE` in
`src/components/styles.ts` consumes them. Zero visual change.

**Stage 2 (open):** Collapse near-duplicate hues in actual usage. The
audit identified:

- **Three greens** → one `OWNED` (currently the mint).
  Creature card chrome (`#3d8e57`) should shift to a desaturated teal
  that doesn't read as "yours". Animals theme tint stays in
  `src/data/elements.ts`.
- **Gold has 5 jobs** → keep two distinct golds: `SELECTION`
  (selection/bond) and `PREMIUM` (coins/legendary). Attack-ready
  pulse should reuse `SELECTION`.
- **Coral vs Damage red.** `BRAND` (coral, "go") and `DAMAGE` (deeper
  crimson, "harm") are already distinct in tokens — but inline hex
  literals across `MatchBoard.tsx` still mix them. Migrate as edits
  touch those areas.
- **Spell violet absorbs silence status.** Silence already _is_ a
  spell effect; reuse `SPELL`.
- **Resource blue absorbs frozen status.** Frozen ≈ mana-locked;
  reuse `RESOURCE`.
- **Tapped → opacity 0.6** (no unique grey overlay).

### How to migrate

When you next edit a component:

1. Look for hex literals (`#ee5a52`, `#06d6a0`, etc.).
2. Replace with the matching token import.
3. If the hex you're touching doesn't map cleanly to any token (e.g.
   a one-off accent inside a single illustration), leave it inline.
4. If two literals in the same area express the same semantic role
   (one says "ownership", the other says "ownership too"), unify
   them on the token — this is how Stage 2 finishes incrementally.

### Element tints

Family / Work / Animals / Travel / Food / Education stay in
`src/data/elements.ts`. They're foundational card identity (think
Magic's mana colors), distinct from the functional palette here.
