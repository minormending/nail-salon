# How the hand gets drawn

**Flat 2D SVG, drawn face-on, as a henna practice sheet.** Decided 2026-11-14.
Implementation in [`tools/hand-2d/`](../tools/hand-2d) — `sheet.py` and
`sheetbuild.py`.

## The hand is a canvas, not a character

This is the thing that took four rejected attempts to see. Henna practice
sheets are a settled genre, and they answer it:

- a **thin, even outline** — one weight, no heavy keyline
- **long slender fingers**, gently splayed, with small plain nails
- **one continuous contour** — no line where the thumb or a finger meets the
  palm
- the **forearm included**, because mehndi runs up it and a hand cropped at the
  wrist has nowhere to put a bracelet
- deliberately understated, so the design on top is what you look at

Everything rejected before this failed the same way: it made the hand the thing
you look at — shaded, heavily outlined, brightly manicured.

### Two hands, two jobs

Henna needs the back of the hand flat and the forearm free, so the henna canvas
is the practice sheet. Nails need the fingertips turned toward you, so the nail
chair uses the pose every nail chart uses: back of the hand, fingers curled
in a diagonal staircase, nails stepping down to the right, thumb up. The charts
show the hand gripping a towel; ours drops it and lets the wrist run off the
bottom of the frame, which keeps the screen to the hand alone. Both are fine line on white.

The nail hand is a raster: Codex's clean line-art redraw of the chart's
"Natural" panel, towel removed. My own vector drawing of the pose
(`tools/hand-2d/pose2.py`) never got the pinky side of the hand right; the
redraw does. The nail shapes stay vector and ours: `tools/hand-2d/codexhand.py`
measures the five nails Codex drew and lays each shape over them, stretched
along the nail so Natural exactly covers the drawn one. The raster is kept on
the design canvas and out of this repo until the chart's licence is settled —
it is a derivative of that chart.

### Skin tones

Six skin tones plus the plain colouring-book outline, chosen at first launch
(`tools/hand-2d/skintones.py` holds the palette). The tone goes under the line
art, so lines stay crisp; on the three deepest tones the outline darkens so
knuckles and finger edges still read. The nail hand is a raster, so its skin
is found by flood-filling the background in from the corners — everything the
outline encloses is skin. Henna is a dye, so the stain multiplies with the
skin: on deep tones it is darker and quieter, as in life. To keep a child's
design visible there, the stain gets a thin edge 30% lighter than the skin,
drawn behind it — the stain's own colour never changes.

### Fifteen nail shapes

`tools/hand-2d/nails.py` defines natural, round, round long, oval, square,
almond, pointed, stiletto, arrow head, edge, rock peak, ballerina, lipstick,
flare and trapeze as parametric outlines with the cuticle at the origin. The
web app's five (oval, round, almond, square, coffin) are a subset; its
`coffin` is the chart's **ballerina**. Each digit's cuticle position and angle
are fixed by the pose, so changing shape swaps five path strings and nothing
else — the hand never redraws. Long shapes hang off the fingertip, which is how
the web app already treats them.

Three of the pointed shapes are easy to confuse, so they are kept apart on
purpose: **arrow head** has a ~90° apex, **rock peak** a squat ~120° gable, and
**edge** a tapered body with a raised ridge down the middle.

### Drawing one contour

Merge every part into a single path, stroke it at **double** the target weight
(this draws the buried seams too), then fill the same path on top. The fill
covers the inner half of that stroke and every internal seam with it, leaving
the outer contour at the target weight. All subpaths must wind the same
direction or `fill-rule: nonzero` subtracts the overlaps instead of uniting
them.

## The screen around it

Mela stays as the app's chrome: cream ground, deep plum line,
turquoise/marigold/magenta/green, Baloo 2 for type. The hand inside it is the
practice sheet above. The notes below describe the earlier, chunkier hand and
are kept for the palette and for why the bake was dropped.

- **Flat fills. No gradient anywhere.**
- A heavy plum `#40163C` keyline on *every* part — each finger outlined
  separately against the palm.
- **Exactly one** flat shadow, `#C4824C` at 55%. Never a ramp.
- Nails bright and individually coloured from the festival palette.

### The proportions are part of the style

This is the part that is easy to miss, and it cost a round trip. Mela is not
just flat colour — the hand is **stylised**:

- fingers short, parallel and vertical, in columns at x 103 / 145 / 187 / 224
- a wide **bowl** of a palm that ends at a flat bottom, rather than tapering
  off the frame into a wrist
- a stubby thumb, about 48 units wide at the base

An anatomically truer hand — fanned fingers, a tapering wrist — reads as an
adult's and looks wrong here however it is shaded.

### How the outlines are made

Each digit is a centreline plus a half-width profile, offset left and right
with a round cap over the tip. Hand-placing bezier handles for anatomy failed
three times; generating from a centreline works, gives taper and joint swelling
for free, and makes a new pose or the mirrored hand a data change rather than a
redraw. The output is still ordinary SVG path data.

### The stain

One `<g>` holds all the henna. Its `fill` is the stain colour, and the four
stages over 48 hours are four values of it. The not-yet-inked state is the same
group with `fill: none` and a dashed `#B5855E` stroke — a guide to trace, which
is Mela's own mechanic.

| | cost |
| --- | --- |
| skin tone | two fills |
| the 48-hour stain | one fill on one group |
| the un-inked guide | the same group, dashed |
| nail polish | one fill per nail |
| the other hand / a new pose | re-run the generator |
| **a motif on a new pose** | **re-place it by hand — see below** |

## What 2D costs

**The henna does not wrap.** A motif is placed against this pose's paths, so a
new pose means re-placing every motif rather than reusing one texture. That is
the real price of flat. It is a content cost that lands later, when the motif
library grows, not a code cost now.

## The 2.5D route, and why it is not what we ship

Worth keeping, because the reasoning was sound and the problem it solves is
real. Implementation is still in [`tools/hand-bake/`](../tools/hand-bake).

Model the hand in 3D once, offline, and keep the render *passes* — mask, shade,
and a **UV pass** where each pixel stores its own `u,v`. At runtime a fragment
shader reads the UV pass and looks the design up in a flat texture, so the
design wraps round fingers for free. (In compositing this is an STMap.) Skin
tone, the stain ramp, the mirrored hand and extra poses all fall out of it.

It works — `tools/hand-bake/reference/` has the proof. It was rejected on
looks: even with the shading posterised flat and a keyline added, the fingers
are still projected tubes, with foreshortening, round caps and perspective fan.
Stripping the shading cannot remove those.

If the motif library ever makes per-pose placement too expensive, this is the
route back. Two things to remember if so: pack the UV pass as 16 bits per axis
across one RGBA PNG (8 bits stair-steps), and never blur, scale or antialias
it.

## Why not a game engine

All five competitors ship Unity (see [market-research.md](market-research.md)),
but they are games — scenes, physics, ad SDKs. An app that composites flat
vector art needs none of it. Godot is the same shape of answer, lighter and
MIT-licensed, worth remembering only if the app ever grows scenes.

Once the hand is SVG, almost anything renders it: the existing web app already
does, and Flutter and React Native both draw vector art natively.

## Licences to avoid

- **MANO** (Max Planck parametric hand) — non-commercial research only, and
  everything derived from it inherits that. It is the first thing you find.
- **Spine** — the runtimes require a paid editor licence, which terminates
  above $500k revenue.
- **Perfect Corp / Banuba / GlamAR / ModiFace** — real nail-AR SDKs, but
  sales-gated and priced for beauty retail. They paint a camera feed, which is
  the grown-up market, not this one.

**MediaPipe Hands** (Apache 2.0) is fine, but only for an optional "decorate a
photo of your own hand" feature — not for the main canvas.
