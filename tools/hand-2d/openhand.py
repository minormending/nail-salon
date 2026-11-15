"""Henna on the open hand: an original line drawing made by Codex from a
text-only prompt (back of a left hand, fingers up and spread, thumb out to the
right, forearm off the bottom). The raster, open_hand_v1.png (1024x1536), lives
in art-private/original/ and is never copied into this repo; set OPEN_HAND_PNG
to point at another copy. Builds every henna image the canvas uses, under the
same file names, so every henna screen picks the hand up unchanged.

The hand is line art, tinted per skin tone under its lines (skintones.py) and
embedded in each SVG; the henna is vector on top. The geometry below was
measured from the drawing: mandala centred on the back of the hand, a cuff
across the narrow wrist, one vine up the midline of each digit.
"""
import base64, io, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sheetbuild as SB
import skintones as ST

SRC = os.environ.get("OPEN_HAND_PNG") or os.path.join(
    HERE, "..", "..", "art-private", "original", "open_hand_v1.png")
VIEWBOX = "0 0 1024 1504"     # the 320:470 frame every henna screen already sizes for

# --- henna geometry in the image's coordinates; filled in from the drawing ---
MANDALA = (445.0, 830.0, 185.0)   # >= 50 px inside the outline all round, below the knuckle creases
CUFF = (1215.0, 1275.0)
WRIST = {1215.0: (270.0, 586.0), 1275.0: (266.0, 588.0)}   # outline x at each cuff edge
VINES = {         # name: ((x0, y0) at the knuckle, (x1, y1) 50 px below the nail's bottom, leaf count, leaf scale)
    # leaf scale is the largest the finger's inner width allows (leaf tips reach 13*scale sideways)
    "pinky":  ((249.0, 600.0), (220.0, 345.0), 4, 2.3),
    "ring":   ((365.0, 575.0), (354.5, 207.0), 5, 2.5),
    "middle": ((480.0, 550.0), (493.5, 132.0), 6, 2.7),
    "index":  ((600.0, 575.0), (630.0, 223.0), 5, 2.55),
    "thumb":  ((744.0, 775.0), (805.0, 687.0), 2, 3.0),
}
LEAF = 3.0


def vine(a, b, n, leaf=LEAF):
    (x0, y0), (x1, y1) = a, b
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    nx, ny = -uy * 3.4, ux * 3.4
    o = ['<path d="M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f Z"/>'
         % (x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny)]
    ang = math.degrees(math.atan2(-ux, uy))
    for i in range(n):
        t = 0.10 + 0.80 * i / max(1, n - 1)
        o.append('<g transform="translate(%.1f %.1f) rotate(%.1f) scale(%.2f)"><use href="#lf"/><use href="#rf"/></g>'
                 % (x0 + dx * t, y0 + dy * t, ang + 180, leaf))
    ex, ey = x1 + ux * 16, y1 + uy * 16
    o.append('<ellipse cx="%.1f" cy="%.1f" rx="8.5" ry="12.5" transform="rotate(%.1f %.1f %.1f)"/>' % (ex, ey, ang, ex, ey))
    return "\n".join(o)


def cuff():
    y0, y1 = CUFF
    xl = max(WRIST[y0][0], WRIST[y1][0]) + 18
    xr = min(WRIST[y0][1], WRIST[y1][1]) - 18
    o = ['<rect x="%.1f" y="%.1f" width="%.1f" height="8"/>' % (xl, y0, xr - xl),
         '<rect x="%.1f" y="%.1f" width="%.1f" height="8"/>' % (xl, y1 - 8, xr - xl)]
    n = max(6, int((xr - xl) / 44))
    step = (xr - xl - 12) / n
    for i in range(n):
        x = xl + 6 + step * i
        o.append('<path d="M %.1f %.1f L %.1f %.1f L %.1f %.1f Z"/>' % (x, y0 + 16, x + step * 0.6, (y0 + y1) / 2, x, y1 - 16))
    return "\n".join(o)


def parts():
    cx, cy, R = MANDALA
    return {"gol": SB.gol(cx, cy, R), "cuff": cuff(),
            "vines": "\n".join(vine(*v) for v in VINES.values())}


def hand_png(skin, line):
    import tempfile
    with tempfile.TemporaryDirectory() as td:       # never leave a raster in tools/
        p = os.path.join(td, "tint.png")
        ST.tint_nail_hand(SRC, skin, line, p)
        return base64.b64encode(open(p, "rb").read()).decode()


def svg(groups, png64):
    P = parts()
    o = ['<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="%s">' % VIEWBOX,
         SB.DEFS,
         '<image width="1024" height="1536" xlink:href="data:image/png;base64,%s"/>' % png64]
    for attrs, names in groups:
        o.append("<g %s>%s</g>" % (attrs, "\n".join(P[n] for n in names)))
    o.append("</svg>")
    return "\n".join(o)


GHOST = 'fill="none" stroke="#B5855E" stroke-width="3.4" stroke-dasharray="10 8"'
ALL = ["gol", "vines", "cuff"]
STAGES = {"paste": "#3B3326", "orange": "#D2691E", "red": "#B2441C", "brown": "#9C3418"}


def stain(tid, skin, colour, true=False):
    ink = ST.stain_on(skin, colour, tid)
    if true or not ST.needs_edge(tid):
        return 'fill="%s" stroke="none"' % ink
    edge = ST.hexs(ST.rgb(skin) + (255 - ST.rgb(skin)) * 0.30)
    return 'fill="%s" stroke="%s" stroke-width="5" paint-order="stroke" stroke-linejoin="round"' % (ink, edge)


def build(out):
    files = {}
    t0 = hand_png("#FFFFFF", "#2B1A26")
    ink = lambda c: 'fill="%s"' % c
    files["henna-bare.svg"] = svg([], t0)
    files["henna-ghost.svg"] = svg([(GHOST, ALL)], t0)
    files["henna-step1.svg"] = svg([(GHOST, ["vines", "cuff"]), (ink(STAGES["paste"]), ["gol"])], t0)
    files["henna-step2.svg"] = svg([(GHOST, ["cuff"]), (ink(STAGES["paste"]), ["gol", "vines"])], t0)
    for k, c in STAGES.items():
        files["henna-%s.svg" % k] = svg([(ink(c), ALL)], t0)
    for tid, label, skin, line in ST.TONES:
        png = t0 if tid == "t0" else hand_png(skin, line)
        # the stencil and Studio stages, so the skin can change mid-design
        ghost = GHOST if not ST.needs_edge(tid) else GHOST.replace(
            "#B5855E", ST.hexs(ST.rgb(skin) + (255 - ST.rgb(skin)) * 0.55))
        paste = stain(tid, skin, STAGES["paste"])
        files["henna-ghost-%s.svg" % tid] = svg([(ghost, ALL)], png)
        files["henna-step1-%s.svg" % tid] = svg([(ghost, ["vines", "cuff"]), (paste, ["gol"])], png)
        files["henna-step2-%s.svg" % tid] = svg([(ghost, ["cuff"]), (paste, ["gol", "vines"])], png)
        files["henna-paste-%s.svg" % tid] = svg([(paste, ALL)], png)
        for k in ("orange", "brown"):
            files["henna-%s-%s.svg" % (k, tid)] = svg([(stain(tid, skin, STAGES[k]), ALL)], png)
            if ST.needs_edge(tid):
                files["henna-%s-%s-true.svg" % (k, tid)] = svg([(stain(tid, skin, STAGES[k], True), ALL)], png)
    for name, s in files.items():
        open(os.path.join(out, name), "w").write(s)
    return sorted(files)


if __name__ == "__main__":
    print(build(sys.argv[1]))
