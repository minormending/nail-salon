"""Assemble the practice-sheet hand. Line weight is the whole art direction."""
import numpy as np
import twod as T, sheet as S

LINE = "#40163C"
FINGERS = ("index", "middle", "ring", "pinky")


def deg(d):
    return np.degrees(np.arctan2(d[0], -d[1]))


def hand(lw=1.9, fill="#FFFFFF"):
    """One continuous contour.

    A practice-sheet hand has no line where the thumb or a finger meets the
    palm -- it is a single silhouette. So: merge every part into one path,
    stroke it at double weight (which draws the buried seams too), then fill
    the same path on top, which covers the inner half of that stroke and every
    seam with it. What is left is the outer contour at `lw`.
    """
    d = " ".join([S.palm_outline()]
                 + [S.digit_outline(n, reverse=True) for n in ("thumb",) + FINGERS])
    return ('<path d="%s" fill="none" stroke="%s" stroke-width="%.2f" stroke-linejoin="round"/>\n'
            '<path d="%s" fill="%s" fill-rule="nonzero"/>' % (d, LINE, lw * 2, d, fill))


def nails(lw=1.6):
    o = ['<g fill="none" stroke="%s" stroke-width="%.2f">' % (LINE, lw)]
    for f in FINGERS + ("thumb",):
        cx, cy, rx, ry, a = S.nail(f)
        o.append('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" transform="rotate(%.1f %.1f %.1f)"/>'
                 % (cx, cy, rx, ry, a, cx, cy))
    o.append('</g>')
    return "\n".join(o)


def gol(cx=164.0, cy=258.0, R=46.0):
    o = ['<g transform="translate(%.1f %.1f) scale(%.4f)">' % (cx, cy, R / 62.0)]
    for i in range(12):
        o.append('<use href="#pOut" transform="rotate(%d)"/>' % (i * 30))
    for i in range(8):
        o.append('<use href="#pIn" transform="rotate(%d)"/>' % (i * 45))
    for i in range(8):
        o.append('<use href="#dS" transform="rotate(%.1f)"/>' % (i * 45 + 22.5))
    for i in range(18):
        o.append('<use href="#dT" transform="rotate(%d)"/>' % (i * 20))
    o.append('<circle r="5.5"/>')
    for i in range(6):
        a = i * np.pi / 3
        o.append('<circle cx="%.1f" cy="%.1f" r="1.7"/>' % (np.cos(a) * 10, np.sin(a) * 10))
    o.append('</g>')
    return "\n".join(o)


def vine(name, t0, t1, n=5, leaf=1.0):
    C = S.centre(name)
    i0, i1 = int(t0 * (len(C) - 1)), int(t1 * (len(C) - 1))
    P = C[i0:i1 + 1, :2][::6]
    tg = np.gradient(P, axis=0)
    tg /= np.linalg.norm(tg, axis=1, keepdims=True) + 1e-9
    nm = np.stack([-tg[:, 1], tg[:, 0]], 1) * 1.1
    o = ['<path d="%s"/>' % T.smooth(list(P + nm) + list((P - nm)[::-1]))]
    for i in range(n):
        x, y, r, d = T.at(C, t0 + (t1 - t0) * (0.08 + 0.84 * i / (n - 1)))
        o.append('<g transform="translate(%.1f %.1f) rotate(%.1f) scale(%.2f)">'
                 '<use href="#lf"/><use href="#rf"/></g>' % (x, y, deg(d), leaf))
    x, y, r, d = T.at(C, t1)
    o.append('<ellipse cx="%.1f" cy="%.1f" rx="2.7" ry="4" transform="rotate(%.1f %.1f %.1f)"/>'
             % (x, y, deg(d), x, y))
    return "\n".join(o)


def cuff(y0=348.0, y1=374.0):
    """A bracelet on the forearm -- the space a practice sheet exists to give you."""
    xl, xr = S.palm_edge(y0, -1) + 5, S.palm_edge(y0, 1) - 5
    o = ['<path d="M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f Z"/>'
         % (xl, y0, xr, y0, xr, y0 + 2.6, xl, y0 + 2.6),
         '<path d="M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f Z"/>'
         % (xl, y1, xr, y1, xr, y1 + 2.6, xl, y1 + 2.6)]
    n = 7
    for i in range(n):
        x = xl + 3 + (xr - xl - 6) * i / n
        w = (xr - xl - 6) / n * 0.58
        o.append('<path d="M %.1f %.1f L %.1f %.1f L %.1f %.1f Z"/>'
                 % (x, y0 + 6, x + w, (y0 + y1) / 2 + 1, x, y1 - 3))
    return "\n".join(o)


def henna(attrs=None):
    o = ['<g %s>' % (attrs or 'fill="#9C3418" stroke="none"'), gol(), cuff()]
    for f in FINGERS:
        o.append(vine(f, 0.14, 0.78, n=5, leaf=0.80))
    o.append(vine("thumb", 0.22, 0.78, n=4, leaf=0.78))
    o.append('</g>')
    return "\n".join(o)


DEFS = '''<defs>
<path id="lf" d="M 0 0 C -5.2 -2.1, -10.4 -6.1, -13 -12.6 C -8.3 -11, -2.6 -6.1, 0 0 Z"/>
<path id="rf" d="M 0 0 C 5.2 -2.1, 10.4 -6.1, 13 -12.6 C 8.3 -11, 2.6 -6.1, 0 0 Z"/>
<path id="pOut" d="M 0 -34 C -7.8 -38, -7.8 -50, 0 -54 C 7.8 -50, 7.8 -38, 0 -34 Z"/>
<path id="pIn" d="M 0 -13 C -6 -16, -6 -23, 0 -26 C 6 -23, 6 -16, 0 -13 Z"/>
<circle id="dS" cy="-31" r="1.9"/>
<circle id="dT" cy="-60" r="1.8"/>
</defs>'''


def inner(attrs=None, lw=1.9, fill="#FFFFFF"):
    return "\n".join([DEFS, hand(lw, fill), henna(attrs), nails(max(1.3, lw * 0.85))])
