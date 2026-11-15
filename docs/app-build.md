# Paisley — the mobile app build

The Expo (React Native) app in `app/`. Design source of truth: the canvas
(https://claude.ai/artifact/VK7NqAVtyBJJcegC6JsQh6), local copy in
`art-private/canvas/*.dc.html` (not in git). Each `.dc.html` is one 390×844
phone screen written as HTML with inline styles; port the markup and inline
styles faithfully to React Native.

## Identity

- Name **Paisley**; Play title `Paisley: Nail & Henna Studio`.
- Package / bundle id `com.minormending.paisley`; Expo slug `paisley`, owner `kkramdath`.
- Expo SDK 58, TypeScript, expo-router (file routes in `app/app/`).
- EAS Build `production` profile → Android App Bundle, channel `production`.
  `runtimeVersion: { policy: "appVersion" }`; expo-updates checks on launch and
  falls back to the embedded bundle offline.

## Rules every screen follows

- Mela look: cream `#FFF3DC` ground, plum `#40163C` ink, magenta `#C2185B`/`#D81E5B`,
  turquoise `#16A0BD`, marigold `#F5A623`, green `#0E8A6E`, muted text `#6A4A60`.
  Borders 2.5px plum. Buttons have a `0 5px 0 #40163C` hard drop (RN: a plum
  view offset 5px behind, not elevation). Fonts Baloo 2 (headings, buttons) and
  Nunito (body), bundled through `@expo-google-fonts/*` — no network.
- **Every button a child can reach shows a picture icon beside its words.**
  Icons are the inline stroke SVGs from the canvas, ported to react-native-svg.
- The round **hand button** at the bottom-left of the four painting screens
  (nail chair, one nail, Salon henna, Studio) cycles/opens the 7 tones
  (`t0` colouring book … `t6` deepest). Tone is global (store).
- **Henna is only ever paste `#3B3326`, orange `#D2691E`, red `#B2441C`,
  reddish-brown `#9C3418`** — multiplied with the skin. Never black, never any
  other colour, anywhere (PPD safety).
- No ads, no accounts, no analytics, no network calls of our own. Works offline.
- Never scold. No scores, no "wrong".
- No sound in v1: the Parents screen drops the Sounds and Music toggles.

## Product decisions for v1

- **Studio is open** ("FREE WHILE IT'S NEW" on Home). There is no Play merchant
  account yet. On first launch the store records `earlyFamily: true` and
  `firstLaunchAt`; a future paid unlock must keep the Studio open for those
  installs. The Unlock screen exists in code but nothing routes to it.
- **Save a picture** saves the framed picture into *My hands* (in-app, under
  the app's document directory). **Send** opens the system share sheet
  (`expo-sharing`) behind the grown-up gate — that is where a grown-up can save
  to Photos. No media-library permission.
- The henna reminder is one local notification (`expo-notifications`) at the
  deepest stage, only if the grown-up setting is on. Ask for notification
  permission the first time a henna is finished, not at launch.

## Stain timeline

A henna design gets `startedAt` (ms) when the child taps *Let it dry*. Stage
from elapsed time, `real` speed (quick = everything ÷ 24):

| stage | from | colour |
| --- | --- | --- |
| paste | 0 | `#3B3326` |
| orange | 30 min | `#D2691E` |
| red | 12 h | `#B2441C` |
| brown (deepest) | 36 h | `#9C3418` |

The notification is scheduled at the deepest stage. Stages are recomputed on
focus; nothing runs in the background.

## Code layout (`app/`)

```
app/                    expo-router routes
  _layout.tsx           fonts, stack, no headers
  index.tsx             Home
  gallery.tsx           My hands
  salon/nails.tsx       nail chair; tap a nail to zoom in (?zoom=thumb|index|…)
  salon/nail.tsx        redirect to /salon/nails?zoom=… (old close-up links)
  salon/henna.tsx       henna stencil
  studio/index.tsx      henna cone
  studio/motifs.tsx     motif library
  stain/[id].tsx        watch it darken
  share/[id].tsx        save a picture
  gate.tsx              ask a grown-up (?next=/parents | share)
  unlock.tsx            (unreachable in v1)
  parents.tsx           for grown-ups
src/theme.ts            colours, fonts, borders
src/components/         Button (icon + label), IconButton, TopBar, RoomTabs,
                        SkinToneButton, Icon set, NailHand, HennaHand
src/art/                generated geometry (nails.json, henna.json, motifs.json)
src/state/store.ts      zustand + AsyncStorage persist
src/lib/stain.ts        stage maths + notification scheduling
assets/hands/           tinted hand rasters per tone (generated)
```

## Store shape (`src/state/store.ts`)

```ts
type ToneId = 't0'|'t1'|'t2'|'t3'|'t4'|'t5'|'t6'
type Digit = 'thumb'|'index'|'middle'|'ring'|'pinky'
type NailLook = { color: string; pattern: 'plain'|'dots'|'stripes'|'french';
                  stickers: { kind: string; x: number; y: number; frame?: 'nail' }[] }
// frame 'nail': x,y in half-widths in the nail's own frame (stickerLocal in NailHand.tsx); else old close-up coordinates
type NailDesign = { shape: string; nails: Record<Digit, NailLook> }
type Stroke = { layer: 0|1; nib: 1|2|3; points: number[] /* x,y,w,... */ }
type Stamp  = { layer: 0|1; motif: string; x: number; y: number; scale: number; rotate: number }
type HennaDesign = { source: 'stencil'|'studio'; parts?: ('gol'|'vines'|'cuff')[];
                     strokes?: Stroke[]; stamps?: Stamp[]; mirror?: boolean }
type Item = { id: string; kind: 'nails'|'henna'; name: string; createdAt: number;
              tone: ToneId; nails?: NailDesign; henna?: HennaDesign;
              startedAt?: number; notificationId?: string; pictureUri?: string }
state: { tone, items: Item[], draftNails: NailDesign, draftHenna: HennaDesign,
         settings: { remind: boolean; speed: 'real'|'quick' },
         earlyFamily: boolean, firstLaunchAt: number }
```
