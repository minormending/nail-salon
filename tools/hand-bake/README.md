# hand-bake

A throwaway proof that the hand does not need a game engine.

It builds a crude 3D hand out of generalized cylinders and a domed slab, renders
it once from a fixed camera, and writes out flat passes — mask, depth, normal,
ambient occlusion and, the important one, a **UV pass**, where each pixel stores
where on the hand it sits. A design painted flat in texture space is then
sampled through that pass, so it wraps round the fingers without anyone drawing
it wrapped.

Nothing here is meant to ship, and the model is not good enough to ship. It
exists to answer one question — *can 2.5D carry henna?* — with pictures instead
of an argument. See [`reference/`](reference) and
[`docs/rendering-approach.md`](../../docs/rendering-approach.md).

```bash
python3 deliver.py     # needs numpy + Pillow, writes out/
```

| file | what it does |
| --- | --- |
| `model.py` | the hand as splined tubes plus a heightfield for the back |
| `bake.py` | rasterises it to flat passes; screen-space AO |
| `atlas.py` | draws the henna and the nails in texture space, flat |
| `sample.py` | the whole trick: bilinear lookup through the UV pass |
| `render.py` | shading, skin tone, the stain ramp, nail polish |
| `deliver.py` | the contact sheets in `reference/` |
