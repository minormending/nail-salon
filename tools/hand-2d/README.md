# hand-2d

The hand the app actually ships: **flat 2D SVG**, drawn face-on, as a henna
**practice sheet**. No bake, no projection, no perspective, nothing rendered.

Two hand datasets live here. `sheet.py` is the one in use — the practice-sheet
hand, fine even outline, slender fingers, forearm included. `twod.py` holds the
earlier Mela-proportions hand (chunky, filled, heavy keyline), kept because the
geometry helpers it exports are shared.

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
| `sheet.py` | **in use** — practice-sheet geometry, and the shared helpers' caller |
| `sheetbuild.py` | **in use** — one merged contour, henna, plain nails, wrist band |
| `twod.py` | shared maths, plus the earlier Mela-proportions hand |
| `build.py` | the earlier chunky assembly: medallion, flat shadow, bright nails |
| `board.py` | emits the Studio screen with the henna group's paint as holes |
| `strips.py` | contact sheets in `reference/` |

`reference/sheets.png` is the line-weight study. `reference/compare.png` is the
earlier chunky hand beside Mela's original.
