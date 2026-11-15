"""The nail-display hand, take two: gripping a cloth.

Thumb up on the left. The four fingers curl over the top of the cloth in a
diagonal staircase -- each one a broad, foreshortened arc from its knuckle
down-left to its nail -- so the nails step down to the right and hang in front
of the fabric. The top of the silhouette IS the row of knuckle arcs.

My own drawing in the pose nail charts use; not a trace. The chart's cloth is
gone: the hand ends in a wrist whose lines run off the bottom of the frame.
"""
import numpy as np
import twod as T
import nails as NL

VB = (320, 470)
LINE = "#2B1A26"

# knuckle (top) -> fingertip (bottom-left). Broad at the knuckle because a
# curled finger shows its side as well as its back; the fan flattens from
# index to pinky.
FINGERS = {
    # packed closer than one diameter apart, so each knuckle arc emerges from
    # behind the finger before it -- the overlap is what makes it a hand
    # rather than four capsules laid side by side
    "pinky":  [(242, 194, 22.0), (234, 220, 20.8), (222, 244, 19.0), (206, 264, 16.8), (194, 276, 15.6)],
    "ring":   [(206, 158, 25.6), (199, 192, 24.0), (186, 226, 22.0), (168, 258, 19.4), (155, 278, 18.0)],
    "middle": [(168, 124, 26.6), (162, 160, 25.0), (150, 198, 23.0), (134, 232, 20.4), (122, 254, 18.8)],
    "index":  [(128, 98, 26.0), (122, 132, 24.6), (112, 166, 22.6), (100, 196, 20.2), (92, 214, 18.6)],
}
# a fat, leaning banana, not a stick: wide where it joins the hand
THUMB = [(66, 286, 27.0), (64, 240, 26.0), (68, 194, 23.0), (76, 152, 19.5),
         (85, 116, 16.5), (93, 88, 14.6), (99, 68, 13.6)]

# Back of the hand and wrist, open at the bottom. Its top-left edge runs
# underneath the thumb, so no stray line shows between the thumb and the index;
# its left edge comes out from under the thumb's outer edge and becomes the wrist.
BODY = [(86, 476), (74, 430), (54, 380), (43, 330), (39, 292), (38.6, 266), (56, 250), (70, 170),
        (96, 112), (128, 100), (168, 124), (206, 158), (242, 194), (276, 214), (298, 246),
        (304, 300), (298, 345), (282, 395), (264, 440), (256, 476)]


def tube(spine, k=3, steps=12, bow=0.0, open_base=None):
    C = T.catmull(spine, 18)
    if bow:
        # arch the finger over its knuckle: push the middle out to the upper right
        t = np.linspace(0, 1, len(C))
        tg0 = C[-1, :2] - C[0, :2]
        tg0 /= np.linalg.norm(tg0)
        n0 = np.array([-tg0[1], tg0[0]])
        if n0[0] < 0:
            n0 = -n0
        C[:, :2] += n0[None, :] * (bow * np.sin(np.pi * t))[:, None]
    P, R = C[:, :2], C[:, 2]
    tg = np.gradient(P, axis=0)
    tg /= np.linalg.norm(tg, axis=1, keepdims=True) + 1e-9
    nm = np.stack([-tg[:, 1], tg[:, 0]], 1)
    left, right = P + nm * R[:, None], P - nm * R[:, None]

    def arc(c, r, a0):
        return [c + r * np.array([np.cos(a0 - s), np.sin(a0 - s)])
                for s in np.linspace(0, np.pi, steps)[1:-1]]

    pts = (T._dec(left, k) + arc(P[-1], R[-1], np.arctan2(nm[-1, 1], nm[-1, 0]))
           + T._dec(list(right[::-1]), k))
    if open_base:
        # no cap at the root: both edges just stop, and the fill closes the gap.
        # The inner edge stops sooner, where the thumb melts into the palm.
        while pts[0][1] > open_base:
            pts.pop(0)
        return T.smooth([pts[0]] + pts + [pts[-1]], close=False), C
    pts += arc(P[0], R[0], np.arctan2(-nm[0, 1], -nm[0, 0]))
    return T.smooth(pts), C


def nail_frame(C, scale=1.45):
    P, R = C[:, :2], C[:, 2]
    d = P[-1] - P[-4]
    d /= np.linalg.norm(d) + 1e-9
    w = scale * R[-1]
    end = P[-1] + d * R[-1]
    return end - d * 0.98 * w, d, w


def deg(d):
    return np.degrees(np.arctan2(d[0], -d[1]))


def wrinkle(C):
    """One short arc inside the knuckle cap -- the only interior mark per finger."""
    P, R = C[:, :2], C[:, 2]
    d = P[3] - P[0]
    d /= np.linalg.norm(d) + 1e-9
    c = P[0] + d * R[0] * 0.38
    a = np.degrees(np.arctan2(-d[1], -d[0]))
    r = R[0] * 0.55
    a0, a1 = np.radians(a - 38), np.radians(a + 38)
    return "M %.1f %.1f A %.1f %.1f 0 0 1 %.1f %.1f" % (
        c[0] + r * np.cos(a0), c[1] + r * np.sin(a0), r, r, c[0] + r * np.cos(a1), c[1] + r * np.sin(a1))


def hand(shape="natural", lw=1.5, nail_attrs=None):
    g = '<g fill="#FFFFFF" stroke="%s" stroke-width="%.2f" stroke-linejoin="round" stroke-linecap="round">' % (LINE, lw)
    o = [g, '<path d="%s" stroke="none"/>' % T.smooth(BODY),
         '<path d="%s" fill="none"/>' % T.smooth([BODY[0]] + BODY + [BODY[-1]], close=False)]
    th, thC = tube(THUMB, open_base=232)
    o.append('<path d="%s"/>' % th)
    frames = {"thumb": thC}
    for name in ("pinky", "ring", "middle", "index"):
        d, C = tube(FINGERS[name], bow=5.0)
        o.append('<path d="%s"/>' % d)
        o.append('<path d="%s" fill="none" stroke-width="%.2f"/>' % (wrinkle(C), lw * 0.55))
        frames[name] = C
    o.append('</g>')
    o.append('<g stroke="%s" stroke-width="%.2f" stroke-linejoin="round" %s>'
             % (LINE, lw, nail_attrs or 'fill="#FFFFFF"'))
    for name in ("thumb", "pinky", "ring", "middle", "index"):
        cut, d, w = nail_frame(frames[name], 1.55 if name == "thumb" else 1.45)
        o.append('<path d="%s" transform="translate(%.1f %.1f) rotate(%.1f)"/>'
                 % (NL.path(shape, w), cut[0], cut[1], deg(d)))
    o.append('</g>')
    return "\n".join(o)


def svg(shape="natural", bg="#FFFFFF", **kw):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d">' % VB
            + '<rect width="%d" height="%d" fill="%s"/>' % (VB[0], VB[1], bg) + hand(shape, **kw) + '</svg>')


DIGITS = ("thumb", "pinky", "ring", "middle", "index")


def body(lw=1.5):
    """Everything except the nails -- the part that never changes with shape."""
    full = hand("natural", lw=lw)
    return full[:full.rindex('<g stroke=')]


def frames():
    out = {"thumb": T.catmull(THUMB, 18)}
    for name in ("pinky", "ring", "middle", "index"):
        _, C = tube(FINGERS[name], bow=5.0)
        out[name] = C
    return out


def nail_specs():
    """Per digit: where the cuticle sits, the angle, and the nail width. These
    do not depend on the shape, so a shape change only swaps path data."""
    F = frames()
    spec = {}
    for name in DIGITS:
        cut, d, w = nail_frame(F[name], 1.55 if name == "thumb" else 1.45)
        spec[name] = (float(cut[0]), float(cut[1]), float(deg(d)), float(w))
    return spec
