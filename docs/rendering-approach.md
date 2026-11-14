# How the hand gets drawn

Short version: **model it in 3D once, offline; ship flat images; no engine on
the phone.**

## Why not just 2D

Nails are fine in 2D — a nail is a flat oval and a decal sits on it. Henna is
not. It wraps a finger, crosses the knuckles and runs over the wrist onto the
forearm. In sprite-sheet 2D every skin tone, every stain stage, every pose and
each hand is a separate set of artwork, and they multiply: six tones × four
stain stages × four poses × two hands is 192 drawings of a single design.

## Why not Unity

All five competitors ship Unity (see [market-research.md](market-research.md)),
but they are games — scenes, physics, ad SDKs. We would be shipping a game
engine in order to composite five images. Godot is the same shape of answer,
lighter and MIT-licensed, and worth remembering if the app ever grows scenes.

## What we do instead — 2.5D

1. Build the hand in 3D **once**, offline. Pose it, light it.
2. Render it at the angle the app uses, and keep the render *passes*:
   - `mask` — coverage, plus per-finger ids
   - `shade` — lighting and ambient occlusion, as a multiply layer
   - `uv` — **the important one**: each pixel stores its own `u,v` on the model
3. Ship those PNGs. At runtime there is no 3D at all — a fragment shader reads
   the UV pass, looks the design up in a flat texture, and multiplies by the
   shade pass.

This is an old compositing technique; in Nuke the node is called an STMap.

### What that buys

| | cost |
| --- | --- |
| skin tone | tint the base colour — one slider, any tone |
| the 48-hour stain | swap a colour multiplier — four numbers |
| nail polish and finish | per-nail masks, same texture space |
| the other hand | mirror the bake; the texture is untouched |
| another pose | another bake, ~1 MB of PNGs |
| feet | a second model and a second bake; design and ramp carry over |

A cured henna stain is dye sitting *in* skin, so it must be a **multiply**, not
a colour. That is what makes one stain ramp read correctly on every skin tone,
including the deepest, where it stays subtle — as it does in life.

### Two things that will bite

- **UV precision.** Eight bits gives 256 steps across the whole hand and a line
  crossing that gradient visibly stair-steps. Pack 16 bits per axis across the
  four channels of one RGBA PNG.
- **Never filter the UV pass.** No blur, no scaling, no antialiasing. A filtered
  UV value is a coordinate pointing somewhere nobody asked for. Composite
  first, downsample after.

### 3D does not mean it looks 3D

The shading pass is just an image. Paint over it once, by hand, and the art
direction survives intact — Toca Boca is Unity and reads hand-drawn. 3D buys the
*mapping*; the look stays a drawing.

## What to build it in

Once the hand is five PNGs and a shader, the engine question mostly dissolves.

- **Flutter** — shaders declared in `pubspec.yaml`, driven through
  `FragmentProgram`; the custom-shader `ImageFilter` path is Impeller-only.
- **React Native + Skia** — an image arrives as a `uniform shader`, read with
  `.eval(xy)`.
- **The existing web app, wrapped** — a WebGL canvas does this today, and it is
  by far the smallest step from where the project is now.

Published minimum-build figures disagree by roughly 3×, so the argument is not
megabytes — it is that you ship no engine you would not otherwise ship.

## Licences to avoid

- **MANO** (Max Planck parametric hand) — non-commercial research only, and
  everything derived from it inherits that. It is the first thing you find.
- **Spine** — the runtimes require a paid editor licence, which terminates above
  $500k revenue.
- **Perfect Corp / Banuba / GlamAR / ModiFace** — real nail-AR SDKs, but
  sales-gated and priced for beauty retail. They paint a camera feed, which is
  the grown-up market, not this one.

**MediaPipe Hands** (Apache 2.0) is fine, but only for an optional "decorate a
photo of your own hand" feature — not for the main canvas.

## Prototype

[`tools/hand-bake/`](../tools/hand-bake) implements all of the above in about
400 lines of Python. The hand it builds is not good enough to ship — the real
one wants an artist and a real mesh — but the pipeline is the one to use.
