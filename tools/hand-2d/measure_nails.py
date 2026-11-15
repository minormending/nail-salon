"""Measure the five drawn nails on the nail hand raster (nails_measured.json).

Each nail is flood-filled from a seed inside it (the outline encloses it, so the
fill is exactly the drawn nail's interior). The nail's axis is the long side of
its minimum-area bounding rectangle, signed to point from the cuticle toward
the free edge: up (-y) for the thumb, whose tip is at the top of the picture,
down (+y) for the four curled fingers.

    python3 measure_nails.py [raster.png]
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT = os.path.join(HERE, "..", "..", "art-private", "original", "nail_hand_v1.png")
SEEDS = {"thumb": (218, 90), "index": (345, 410), "middle": (435, 565),
         "ring": (525, 690), "pinky": (632, 750)}


def measure(src):
    g = np.array(Image.open(src).convert("L"))
    free = Image.fromarray(np.where(g >= 200, 255, 0).astype(np.uint8))
    out = {}
    for k, seed in SEEDS.items():
        c = free.copy()
        ImageDraw.floodfill(c, seed, 128)
        ys, xs = np.nonzero(np.array(c) == 128)
        P = np.stack([xs, ys], 1).astype(float)
        cen = P.mean(0)
        best = None
        for deg in np.arange(0, 180, 0.5):
            a = math.radians(deg)
            u = np.array([math.cos(a), math.sin(a)])
            v = np.array([-u[1], u[0]])
            pu, pv = (P - cen) @ u, (P - cen) @ v
            area = (pu.max() - pu.min()) * (pv.max() - pv.min())
            if best is None or area < best[0]:
                best = (area, u, v, pu, pv)
        _, u, v, pu, pv = best
        if (pu.max() - pu.min()) < (pv.max() - pv.min()):
            u, v, pu, pv = v, u, pv, pu            # long side is the axis
        want_up = (k == "thumb")
        if (u[1] < 0) != want_up:
            u, pu = -u, -pu
        out[k] = {"c": [float(cen[0]), float(cen[1])], "ax": [float(u[0]), float(u[1])],
                  "tmin": float(pu.min()), "tmax": float(pu.max()),
                  "width": float(pv.max() - pv.min()), "area": int(len(P))}
    return out


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    m = measure(src)
    json.dump(m, open(os.path.join(HERE, "nails_measured.json"), "w"), indent=1)
    for k, v in m.items():
        print(k, [round(x, 1) for x in v["c"]], [round(x, 3) for x in v["ax"]],
              round(v["tmin"], 1), round(v["tmax"], 1), round(v["width"], 1), v["area"])
