"""Export the app's hand art: tinted rasters, nail geometry, henna geometry.

    python3 export_app.py

Reads nail_hand_v1.png and open_hand_v1.png from art-private/original/ (never
copied into tools/) and nails_measured.json, and writes

    app/assets/hands/nail-hand-t0..t6.png, open-hand-t0..t6.png
    app/src/art/nails.json
    app/src/art/henna.json

Needs rsvg-convert (part bounds) and numpy/Pillow.
"""
import io, json, math, os, re, subprocess, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import codexhand as CH, nails as NL, openhand as OH, skintones as ST, sheetbuild as SB

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ORIG = os.path.join(ROOT, "art-private", "original")
NAIL_PNG = CH.RASTER
OPEN_PNG = OH.SRC
ASSETS = os.path.join(ROOT, "app", "assets", "hands")
ART = os.path.join(ROOT, "app", "src", "art")
W, H = 1024, 1536
HANDCLIP_ERODE = 6        # px: clip sits on the inner edge of the outline stroke
HANDCLIP_EPS = 0.8        # px: Douglas-Peucker tolerance


# ---------------------------------------------------------------- rasters
def export_rasters():
    os.makedirs(ASSETS, exist_ok=True)
    for tid, label, skin, line in ST.TONES:
        ST.tint_hand_rgba(NAIL_PNG, skin, line, os.path.join(ASSETS, "nail-hand-%s.png" % tid))
        ST.tint_hand_rgba(OPEN_PNG, skin, line, os.path.join(ASSETS, "open-hand-%s.png" % tid))


# ---------------------------------------------------------------- nails
def path_points(d, a, ox, oy):
    """Conservative image-space points of a stretched nail path (for the bbox)."""
    toks = re.findall(r"[MLCQAZ]|-?\d+(?:\.\d+)?", d)
    ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
    tr = lambda x, y: (ox + x * ca - y * sa, oy + x * sa + y * ca)
    pts, i, cmd = [], 0, None
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t; i += 1; continue
        if cmd == "A":
            rx, ry, rot, laf, sf, x, y = (float(v) for v in toks[i:i + 7])
            pts += [tr(x, y), tr(x - rx, y - ry), tr(x + rx, y - ry), tr(x - rx, y), tr(x + rx, y)]
            i += 7
        else:
            pts.append(tr(float(t), float(toks[i + 1]))); i += 2
    return pts


def export_nails():
    specs = CH.specs()
    digits, shapes = {}, {}
    xs, ys = [], []
    for k in CH.DIGITS:
        x, y, a, w, s = specs[k]
        digits[k] = {"x": round(x, 2), "y": round(y, 2), "rotate": round(a, 3),
                     "scaleY": round(s, 4), "w": round(w, 2),
                     "tip": [round(CH.M[k]["c"][0], 1), round(CH.M[k]["c"][1], 1)]}
    for shape in NL.SHAPES:
        shapes[shape] = {}
        for k in CH.DIGITS:
            d = CH.nail_path(shape, k)           # already stretched along the nail
            shapes[shape][k] = d
            x, y, a, w, s = specs[k]
            for px, py in path_points(d, a, x, y):
                xs.append(px); ys.append(py)
    pad = CH.LW / 2 + 2
    head = int(math.ceil((-min(ys) + pad) / 10.0) * 10) if min(ys) < 0 else 0
    foot = int(math.ceil((max(ys) + pad - H) / 10.0) * 10) if max(ys) + pad > H else 0
    print("nail extents x %.0f..%.0f y %.0f..%.0f -> headroom %d, footroom %d"
          % (min(xs), max(xs), min(ys), max(ys), head, foot))
    out = {"viewBox": "0 %d %d %d" % (-head, W, H + head + foot),
           "image": {"width": W, "height": H},
           "line": {"color": CH.LINE, "width": CH.LW},
           "digits": digits, "shapes": shapes}
    json.dump(out, open(os.path.join(ART, "nails.json"), "w"), indent=1)


# ---------------------------------------------------------------- henna
def plain(svg):
    """react-native-svg-friendly: circles become ellipses."""
    return re.sub(r'<circle([^>]*?)\sr="([^"]+)"([^>]*)/>',
                  r'<ellipse\1 rx="\2" ry="\2"\3/>', svg)


def render_bbox(defs, frag):
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
           'width="%d" height="%d" viewBox="0 0 %d %d">%s<g fill="#000">%s</g></svg>' % (W, H, W, H, defs, frag))
    r = subprocess.run(["rsvg-convert"], input=svg.encode(), capture_output=True, check=True)
    a = Image.open(io.BytesIO(r.stdout)).convert("RGBA").split()[3]
    x0, y0, x1, y1 = a.getbbox()
    return [x0, y0, x1 - x0, y1 - y0]


def disk_erode(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                out &= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def trace_outer(m):
    """Moore-neighbour trace of the outer boundary of the blob holding the
    top-left-most pixel of m (the hand: one connected silhouette)."""
    P = np.pad(m, 1)
    ys, xs = np.nonzero(P)
    sy = ys.min(); sx = xs[ys == sy].min()
    nb = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]   # clockwise from N
    start = (sy, sx)
    cur, b = start, (sy, sx - 1)               # west of the start is background
    pts = [start]
    for _ in range(8 * int(m.sum())):
        k = nb.index((b[0] - cur[0], b[1] - cur[1]))
        for i in range(1, 9):
            d = (k + i) % 8
            c = (cur[0] + nb[d][0], cur[1] + nb[d][1])
            if P[c]:
                pd = (k + i - 1) % 8
                b = (cur[0] + nb[pd][0], cur[1] + nb[pd][1])
                cur = c
                break
        else:
            break
        if cur == start:
            break
        pts.append(cur)
    return [(x - 1 + 0.5, y - 1 + 0.5) for y, x in pts]


def dp(pts, eps):
    pts = np.array(pts)
    keep = np.zeros(len(pts), bool); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        p, q = pts[a], pts[b]
        v = q - p
        n = np.hypot(*v)
        seg = pts[a + 1:b]
        dr = seg - p
        dist = np.abs(v[0] * dr[:, 1] - v[1] * dr[:, 0]) / n if n else np.hypot(dr[:, 0], dr[:, 1])
        i = int(np.argmax(dist))
        if dist[i] > eps:
            keep[a + 1 + i] = True
            stack += [(a, a + 1 + i), (a + 1 + i, b)]
    return pts[keep]


def hand_clip():
    m = ST.skin_mask(OPEN_PNG)
    m = disk_erode(m, HANDCLIP_ERODE)
    pts = trace_outer(m)
    simp = dp(pts + [pts[0]], HANDCLIP_EPS)[:-1]
    d = "M " + " L ".join("%.1f %.1f" % (x, y) for x, y in simp) + " Z"
    print("handClip: %d traced points -> %d" % (len(pts), len(simp)))
    return d


def export_henna():
    defs = plain(SB.DEFS)
    parts = {k: plain(v) for k, v in OH.parts().items()}
    bounds = {k: render_bbox(defs, v) for k, v in parts.items()}
    tones = []
    for tid, label, skin, line in ST.TONES:
        edge = ST.hexs(ST.rgb(skin) + (255 - ST.rgb(skin)) * 0.30) if ST.needs_edge(tid) else None
        ghost = ("#B5855E" if not ST.needs_edge(tid)
                 else ST.hexs(ST.rgb(skin) + (255 - ST.rgb(skin)) * 0.55))
        tones.append({"id": tid, "label": label, "skin": skin, "line": line, "edge": edge, "ghost": ghost,
                      "stain": {k: ST.stain_on(skin, c) for k, c in OH.STAGES.items()}})
    out = {"viewBox": OH.VIEWBOX, "image": {"width": W, "height": H},
           "defs": defs, "parts": parts, "partBounds": bounds,
           "stages": OH.STAGES, "tones": tones, "handClip": hand_clip()}
    json.dump(out, open(os.path.join(ART, "henna.json"), "w"), indent=1)
    print("partBounds", bounds)


if __name__ == "__main__":
    os.makedirs(ART, exist_ok=True)
    export_rasters()
    export_nails()
    export_henna()
    print("ok")
