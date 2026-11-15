"""The henna practice-sheet hand: fine even outline, slender fingers, forearm.

The hand is a canvas, not a character. Everything here is understated on
purpose -- thin line, small plain nails, no fill weight -- so the design on top
is what you look at. The forearm matters: mehndi runs up it, and every practice
sheet includes it.
"""
import numpy as np
import twod as T

VB = (320, 470)

DIGITS = {
    # closer together than anatomy wants: on a practice sheet the fingers nearly
    # touch, and wide gaps make the hand read as a splayed starfish
    "index":  [(126, 246, 12.8), (124, 200, 12.6), (121, 170, 12.5), (118, 140, 12.0), (116, 112, 11.3),
               (115, 90, 10.5), (114.5, 76, 9.8)],
    "middle": [(153, 250, 13.4), (152, 204, 13.2), (151, 172, 13.1), (150.5, 138, 12.6), (150, 102, 11.8),
               (150, 76, 10.9), (150, 60, 10.2)],
    "ring":   [(179, 246, 13.0), (180, 202, 12.8), (182, 172, 12.7), (184, 140, 12.2), (186, 106, 11.4),
               (187, 84, 10.6), (187.5, 70, 9.9)],
    "pinky":  [(204, 248, 11.6), (206, 208, 11.4), (209, 184, 11.3), (212, 158, 10.8), (215, 134, 10.1),
               (218, 114, 9.4), (219, 102, 8.8)],
    "thumb":  [(138, 330, 18.4), (124, 306, 17.6), (112, 288, 16.6), (97, 268, 15.4), (81, 248, 14.2),
               (67, 230, 13.2), (57, 216, 12.3), (51, 207, 11.6)],
}

# knuckles, then the wrist, then the forearm running off the bottom of the frame
PALM = [(470, 44, 152), (420, 42, 153), (380, 41, 154), (348, 43, 156),
        (322, 50, 158), (296, 61, 161), (268, 70, 163), (240, 74, 164), (214, 74, 164)]

KNUCKLE = ((114.5, 190), (150, 182), (187.5, 190), (218, 208))
PALM_BOT = 470.0


def centre(name, n=26):
    return T.catmull(DIGITS[name], n)


def palm_top(x):
    x = np.asarray(x, float)
    peak = np.zeros_like(x)
    for kx, ky in KNUCKLE:
        peak = np.maximum(peak, (222.0 - ky) * np.exp(-((x - kx) / 20.0) ** 2))
    web = 222.0 - peak
    lo = 1.0 / (1.0 + np.exp((x - 96.0) / 6.0))        # the thumb web, much lower
    return web + 40.0 * lo + 14.0 / (1.0 + np.exp((231.0 - x) / 5.0))


def palm_edge(y, side):
    P = np.asarray(PALM, float)
    a = np.interp(y, P[::-1, 0], P[::-1, 1])
    cx = np.interp(y, P[::-1, 0], P[::-1, 2])
    return cx + side * a


def digit_outline(name, cap_steps=11, k=4, reverse=False):
    C = centre(name)
    P, R = C[:, :2], C[:, 2]
    tg = np.gradient(P, axis=0)
    tg /= np.linalg.norm(tg, axis=1, keepdims=True) + 1e-9
    nm = np.stack([-tg[:, 1], tg[:, 0]], 1)
    left, right = P + nm * R[:, None], P - nm * R[:, None]
    a0 = np.arctan2(nm[-1, 1], nm[-1, 0])
    cap = [P[-1] + R[-1] * np.array([np.cos(a0 - s), np.sin(a0 - s)])
           for s in np.linspace(0, np.pi, cap_steps)[1:-1]]
    pts = T._dec(left, k) + cap + T._dec(list(right[::-1]), k)
    # every subpath of the merged silhouette must wind the same way, or
    # fill-rule nonzero subtracts the overlap instead of uniting it
    return T.smooth(pts[::-1] if reverse else pts)


def palm_outline():
    J = 250.0
    ys = np.linspace(PALM_BOT, J, 14)
    left = [(palm_edge(y, -1), y) for y in ys]
    xs = np.linspace(palm_edge(J, -1), palm_edge(J, 1), 36)
    top = [(x, min(float(palm_top(x)), J)) for x in xs]
    right = [(palm_edge(y, 1), y) for y in ys[::-1]]
    return T.smooth(left + top + right)


def nail(name):
    """Small, plain, sitting just inside the tip. On a practice sheet the nail
    is a mark, not a feature."""
    C = centre(name)
    i = len(C) - 1
    x, y, r = C[i, 0], C[i, 1], C[i, 2]
    d = C[i, :2] - C[i - 3, :2]
    d /= np.linalg.norm(d) + 1e-9
    cx, cy = x + d[0] * r * 0.12, y + d[1] * r * 0.12
    ang = np.degrees(np.arctan2(d[0], -d[1]))
    return cx, cy, r * 0.60, r * 0.96, ang
