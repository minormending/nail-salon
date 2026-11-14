# hand-2d

The hand the app actually ships: **flat 2D SVG**, drawn face-on, in the Mela
style. No bake, no projection, no perspective, nothing rendered.

Outlines are generated rather than hand-placed — each digit is a centreline
plus a half-width profile, offset to left and right with a round cap over the
tip. That is what gives a tapered finger with a slightly swollen joint instead
of a sausage, and it means a new pose or the mirrored hand is a data change
rather than a redraw. The **output is SVG path data**: about 22 kB for the whole
hand, medallion included.

```bash
python3 build.py hand2d.svg     # standalone SVG
python3 board.py                # the Studio screen, SVG inlined
python3 strips.py               # the stain and skin-tone contact sheets
```

| file | what it does |
| --- | --- |
| `twod.py` | geometry: centrelines, width profiles, outlines, the palm bowl |
| `build.py` | assembles medallion, hand, one flat shadow, henna, nails |
| `board.py` | emits the Studio screen with the henna group's paint as holes |
| `strips.py` | contact sheets in `reference/` |

`reference/compare.png` is this hand beside Mela's original — the check that
settled the proportions.
