"""A 2D vector hand. No bake, no projection, no perspective.

Outlines come from a centreline plus a half-width profile, which is how you get
a tapered finger with a swollen joint instead of a sausage -- but the OUTPUT is
SVG path data, drawn flat and face-on. Nothing here is rendered.
"""
import numpy as np

VB = (320, 470)

# (x, y, half-width), base first, tip last. Widths narrow toward the tip and
# swell slightly at the joints; a constant width is what reads as a tube.
DIGITS = {
    # Mela's proportions, not anatomy's: fingers parallel and vertical, the
    # columns at x 103/145/187/224. An anatomically fanned hand reads as an
    # adult's and does not belong in this style.
    "index":  [(103, 282, 17.6), (103, 254, 17.9), (103, 228, 17.0), (103, 196, 17.3),
               (103, 164, 16.2), (103, 136, 15.9), (103, 116, 14.6)],
    "middle": [(145, 284, 18.4), (145, 254, 18.7), (145, 226, 17.8), (145, 190, 18.1),
               (145, 152, 16.9), (145, 116, 16.6), (145, 92, 15.3)],
    "ring":   [(187, 282, 18.0), (187, 254, 18.3), (187, 228, 17.4), (187, 194, 17.7),
               (187, 160, 16.5), (187, 128, 16.2), (187, 110, 14.9)],
    "pinky":  [(224, 284, 15.8), (224, 258, 16.0), (224, 238, 15.2), (224, 214, 15.4),
               (224, 190, 14.3), (224, 168, 14.0), (224, 155, 12.9)],
    "thumb":  [(104, 356, 24.0), (92, 338, 22.4), (78, 318, 20.8), (62, 298, 19.2),
               (46, 280, 17.8), (33, 268, 16.9), (24, 260, 16.2)],
}

# A bowl, not a forearm: wide at the knuckles, rounding in to a flat bottom at
# 438. Tapering off the bottom of the frame as a wrist is what made the palm
# read as small and the fingers as long.
PALM = [(438, 46, 150), (420, 56, 150), (400, 68, 151), (375, 79, 153),
        (345, 86, 155), (316, 90, 156), (290, 90, 156), (268, 88, 156)]

KNUCKLE = ((103, 250), (145, 244), (187, 252), (224, 268))
PALM_TOP, PALM_BOT = 244.0, 438.0


def catmull(P, n):
    P = np.asarray(P, float)
    e = np.vstack([P[0] + (P[0] - P[1]), P, P[-1] + (P[-1] - P[-2])])
    out = []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = e[i], e[i + 1], e[i + 2], e[i + 3]
        t = np.linspace(0, 1, n, endpoint=False)[:, None]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-1][None, :])
    return np.vstack(out)


def centre(name, n=26):
    return catmull(DIGITS[name], n)


def at(C, t):
    """Point and unit tangent at fraction t along a centreline (0 = base)."""
    i = int(np.clip(t, 0, 1) * (len(C) - 1))
    j = min(i + 1, len(C) - 1); k = max(i - 1, 0)
    d = C[j, :2] - C[k, :2]
    d = d / (np.linalg.norm(d) + 1e-9)
    return C[i, 0], C[i, 1], C[i, 2], d


def smooth(pts, close=True):
    """Quadratic midpoint smoothing -- short path data, no visible facets."""
    p = np.asarray(pts, float)
    d = ["M %.1f %.1f" % tuple((p[0] + p[1]) / 2)]
    for i in range(1, len(p) - 1):
        m = (p[i] + p[i + 1]) / 2
        d.append("Q %.1f %.1f %.1f %.1f" % (p[i][0], p[i][1], m[0], m[1]))
    if close:
        m = (p[-1] + p[0]) / 2
        d.append("Q %.1f %.1f %.1f %.1f" % (p[-1][0], p[-1][1], m[0], m[1]))
        d.append("Z")
    return " ".join(d)


def _dec(a, k):
    """Keep every k-th point, always keeping the last. Smoothing 150 points
    makes an 8kB path for one finger; 30 points look identical."""
    a = list(a)
    out = a[::k]
    if out[-1] is not a[-1]:
        out.append(a[-1])
    return out


def digit_outline(name, cap_steps=11, k=5):
    """Left side up, round cap over the tip, right side down, flat across the base."""
    C = centre(name)
    P, R = C[:, :2], C[:, 2]
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-9
    Nn = np.stack([-T[:, 1], T[:, 0]], 1)
    left = P + Nn * R[:, None]
    right = P - Nn * R[:, None]
    a0 = np.arctan2(Nn[-1, 1], Nn[-1, 0])
    cap = [P[-1] + R[-1] * np.array([np.cos(a0 - s), np.sin(a0 - s)])
           for s in np.linspace(0, np.pi, cap_steps)[1:-1]]
    return smooth(_dec(left, k) + cap + _dec(list(right[::-1]), k))


def palm_top(x):
    x = np.asarray(x, float)
    peak = np.zeros_like(x)
    for kx, ky in KNUCKLE:
        peak = np.maximum(peak, (288.0 - ky) * np.exp(-((x - kx) / 23.0) ** 2))
    web = 288.0 - peak
    lo = 1.0 / (1.0 + np.exp((x - 82.0) / 7.0))          # first web space, much lower
    return web + 24.0 * lo + 16.0 / (1.0 + np.exp((238.0 - x) / 6.0))


def palm_edge(y, side):
    P = np.asarray(PALM, float)
    a = np.interp(y, P[::-1, 0], P[::-1, 1])
    cx = np.interp(y, P[::-1, 0], P[::-1, 2])
    return cx + side * a


def palm_outline():
    J = 292.0                       # where the side edges hand over to the top
    ys = np.linspace(PALM_BOT, J, 11)
    left = [(palm_edge(y, -1), y) for y in ys]
    xs = np.linspace(palm_edge(J, -1), palm_edge(J, 1), 34)
    top = [(x, min(float(palm_top(x)), J)) for x in xs]
    right = [(palm_edge(y, 1), y) for y in ys[::-1]]
    return smooth(left + top + right)


def right_sliver(name, frm=0.0, to=1.0, depth=0.42):
    """Mela's single flat form shadow: a crescent down the right side of a part."""
    C = centre(name)
    P, R = C[:, :2], C[:, 2]
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-9
    Nn = np.stack([-T[:, 1], T[:, 0]], 1)
    i0, i1 = int(frm * (len(P) - 1)), int(to * (len(P) - 1))
    sl = slice(i0, i1 + 1)
    outer = P[sl] - Nn[sl] * R[sl, None]
    inner = P[sl] - Nn[sl] * R[sl, None] * (1 - depth)
    return smooth(_dec(outer, 6) + _dec(list(inner[::-1]), 6))


def palm_sliver(y0=296.0, y1=434.0, depth=0.30):
    ys = np.linspace(y0, y1, 14)
    outer = [(palm_edge(y, 1), y) for y in ys]
    inner = [(palm_edge(y, 1) - 2 * palm_edge(y, 1) * 0 - depth * (palm_edge(y, 1) - palm_edge(y, -1)) / 2, y)
             for y in ys[::-1]]
    return smooth(outer + inner)
