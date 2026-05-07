# Aetherborn — Photo TCG

> You don't earn art. You make it.

A trading card game where every card arrives **dormant** — stats and abilities, no picture. To bring a card to life, you take a photo of something in the real world. Your dog becomes a 3/2 Ember Hound. The succulent on your desk is now a 2/5 taunting Bloomshield. Without a photo, the card can't go in your deck.

Built as a Vite + React + TypeScript SPA. No backend — your collection lives in `localStorage`.

## How to play

1. **Open packs** with coins. Each pack is 5 random cards, all dormant. Rare+ guaranteed.
2. **Summon cards** by tapping a dormant card in your collection and snapping a photo (real camera, with file-upload fallback).
3. **Build a deck** of summoned cards (8 max). Dormant cards aren't allowed.
4. **Battle Vex** the Voidcaller in 1-on-1 matches. Drag cards from your hand to play, tap creatures to attack. Win to earn coins, open more packs, summon more cards.

### Rules at a glance

- 24 starting HP each, mana ramps from 1 → 10
- Creatures normally have summoning sickness; **Rush** lets them attack the turn they're played
- **Taunt** creatures must be hit first
- **Untargetable** creatures can't be hit by spells
- Spells: damage, heal, freeze, buff, draw

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # produces dist/
```

## Deploying to Vercel

This is a static SPA — Vercel auto-detects Vite. Just connect the GitHub repo and deploy. No config needed; the build command `npm run build` and output directory `dist` are picked up automatically.

## Project layout

```
src/
├── App.tsx                  screen router
├── data/
│   ├── elements.ts          element colors, rarity weights
│   ├── templates.ts         30 card definitions
│   └── samplePhotos.ts      SVG silhouettes for AI opponent
├── game/
│   ├── types.ts             TypeScript types
│   ├── match.ts             pure-functional engine (turn, play, attack)
│   ├── ai.ts                opponent decision-making
│   └── pack.ts              pack opening + currency
├── hooks/
│   └── usePersistedState.ts localStorage-backed useState
├── components/              Card, BattlefieldCard, ElementGlyph, …
└── screens/                 HomeMenu, Collection, Capture, DeckBuilder, PackOpening, MatchBoard
```

The match engine in `game/match.ts` is fully pure — every action returns a new `MatchState` — which makes the AI in `game/ai.ts` straightforward (it just calls the same engine functions the UI does).

## Camera permissions

The Capture screen uses `getUserMedia({ facingMode: 'environment' })` — this requires HTTPS in production (Vercel provides this automatically). If the camera is denied or unavailable, the screen falls back to a file-picker.
