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

**Stage 2 (done):** Visible unifications applied.

- ✅ **Creature chrome → muted teal.** `TYPE_PALETTE.Creature` moved
  from forest green (`#5ea76b` / `#1f4d2d`) to teal (`#5a8a7e` /
  `#1f4641`). The Type · Theme chip on each creature card matches via
  a new `chip` field on `TYPE_PALETTE` (`#3d7a72` for creatures).
  Removes the three-greens collision with `OWNED` mint.
- ✅ **Silence status → `SPELL` violet.** Silence is a spell effect,
  so the status pill on a silenced creature now matches the violet
  used on spell-card chrome.
- ✅ **Frozen status → `RESOURCE` token.** Same hex, just sourced from
  the token instead of a literal — frozen ≈ mana-locked.
- ✅ **Unaffordable cost ring → `DAMAGE` token.** The "you can't pay
  this" affordance reads consistently with HP/destructive surfaces.
- ✅ **Tapped → opacity 0.6.** Already in place pre-audit; no change
  required.

**Stage 3 (open):** Lower-priority unifications.

- **Gold has 5 jobs** → keep two distinct golds: `SELECTION`
  (selection/bond/attack-ready) and `PREMIUM` (coins/legendary). The
  two hexes are already distinct in tokens; this is a tokenize-the-
  literal pass, not a recolor.
- **Coral vs Damage red gap.** `BRAND` and `DAMAGE` are distinct in
  tokens, but destructive-action button gradients still pull from
  `#ee5a52` (BRAND) instead of a DAMAGE-family hue. The "Remove from
  deck" / "Delete deck" / "Give up" buttons could shift to a tighter
  crimson range so "primary CTA" and "destructive CTA" don't visually
  collapse.
- **Element tints** still live in `src/data/elements.ts` and won't
  move — they're foundational card identity.

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
