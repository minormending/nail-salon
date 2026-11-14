# How the hand gets drawn

**Flat 2D SVG, drawn face-on, in the Mela style.** Decided 2026-11-14 after
trying a 2.5D bake and rejecting it. Implementation in
[`tools/hand-2d/`](../tools/hand-2d).

## The style

Mela is the festival direction: cream ground, deep plum keyline,
turquoise/marigold/magenta/green, Baloo 2 for type.

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
