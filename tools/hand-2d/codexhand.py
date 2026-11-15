"""Nail placement on Codex's redraw of the chart hand (natural_clean.png, 1024x1536).

The hand is a raster: Codex's clean line-art redraw of the "Natural" panel of
the nail-shapes chart, towel removed. It is not in this repo -- it lives on the
design canvas as img/nail-hand.png -- because it derives from a chart whose
licence we have not established. nails_measured.json holds the five drawn
nails (centre, axis, extent, width), measured by flood-filling each one.
Every shape from nails.py is laid over them, stretched along the nail so
Natural exactly covers the nail Codex drew.
"""
import json, math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nails as NL

HERE = os.path.dirname(os.path.abspath(__file__))
M = json.load(open(os.path.join(HERE, "nails_measured.json")))
DIGITS = ("thumb", "index", "middle", "ring", "pinky")
LINE, LW = "#2B1A26", 6.0
# headroom above the image for the thumb's long shapes
VIEWBOX = "0 -170 1024 1706"


def specs():
    """Per digit: cuticle origin, angle, width and the along-nail stretch that
    makes the Natural shape cover the nail Codex drew."""
    out = {}
    for k in DIGITS:
        m = M[k]
        ax = m["ax"]
        wd = m["width"] + LW
        ld = m["tmax"] - m["tmin"] + LW
        w = wd * 1.04
        # the cuticle U bulges 0.206w behind the origin; start it a line-width
        # behind the drawn cuticle so the drawn one is covered, not doubled
        ld += LW
        s = ld / ((NL.LENGTH["natural"] + 0.206) * w)
        cut = [m["c"][0] + ax[0] * (m["tmin"] - 1.5 * LW), m["c"][1] + ax[1] * (m["tmin"] - 1.5 * LW)]
        o = [cut[0] + ax[0] * 0.206 * w * s, cut[1] + ax[1] * 0.206 * w * s]
        out[k] = (o[0], o[1], math.degrees(math.atan2(ax[0], -ax[1])), w, s)
    return out


def transform(k):
    x, y, a, w, s = specs()[k]
    return "translate(%.1f %.1f) rotate(%.1f) scale(1 %.3f)" % (x, y, a, s)


def nails(shape, fill="#FFFFFF"):
    o = ['<g stroke="%s" stroke-width="%.1f" stroke-linejoin="round" fill="%s">' % (LINE, LW, fill)]
    for k in DIGITS:
        o.append('<path d="%s" transform="%s" vector-effect="non-scaling-stroke"/>'
                 % (NL.path(shape, specs()[k][3]), transform(k)))
    o.append("</g>")
    return "\n".join(o)


def svg(shape, fill="#FFFFFF", href="natural_clean.png"):
    return ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="%s">'
            '<image xlink:href="%s" width="1024" height="1536"/>%s</svg>' % (VIEWBOX, href, nails(shape, fill)))


def stretch(d, s):
    """Scale a nails.py path along the nail (y) by s. nails.py writes absolute
    M/L/C/Q/A/Z only, and its arcs are unrotated, so ry scales with y."""
    import re
    toks = re.findall(r"[MLCQAZ]|-?\d+(?:\.\d+)?", d)
    out, i, cmd = [], 0, None
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t
            out.append(t)
            i += 1
            continue
        if cmd == "A":
            rx, ry, rot, laf, sf, x, y = (float(v) for v in toks[i:i + 7])
            out.append("%.2f %.2f %d %d %d %.2f %.2f" % (rx, ry * s, rot, laf, sf, x, y * s))
            i += 7
        else:
            out.append("%.2f %.2f" % (float(toks[i]), float(toks[i + 1]) * s))
            i += 2
    return " ".join(out)


def nail_path(shape, k):
    x, y, a, w, s = specs()[k]
    return stretch(NL.path(shape, w), s)


def placement(k):
    x, y, a, w, s = specs()[k]
    return "translate(%.1f %.1f) rotate(%.1f)" % (x, y, a)
