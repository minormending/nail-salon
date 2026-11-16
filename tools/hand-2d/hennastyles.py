"""More henna designs for the Salon stencil: five per position of the open hand.

    gol     bloom (today's medallion), lotus, paisley, sunburst, jaali
    finger  vines (today's vine), rings, tips, chevrons, drops   -- the four fingers and the thumb
    cuff    arrows (today's cuff), scallops, dots, beads, vineband

Every design is an SVG fragment of plain filled shapes in the open hand's image
coordinates (see openhand.py): no fill or stroke attributes, because the app
paints the henna. A ring (an outline) is one path whose inner contour runs the
other way round, so it needs no fill rule. Nothing here touches today's
parts; `bloom`, `vines` and `arrows` are openhand's own output.

Each digit is a Frame: u runs from the knuckle along the finger, v across it, so
a design is written once and laid along any digit. How wide the finger really
is at each u is measured from the drawing (the same raster openhand.py reads),
so every design is sized to the finger it sits on.
"""
import math, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import openhand as OH
import sheetbuild as SB

SECTIONS = ["gol", "thumb", "index", "middle", "ring", "pinky", "cuff"]
DIGITS = ["thumb", "index", "middle", "ring", "pinky"]
STYLES = {
    "gol": [("bloom", "Bloom"), ("lotus", "Lotus"), ("paisley", "Paisley"), ("sunburst", "Sunburst"), ("jaali", "Jaali")],
    "finger": [("vines", "Vines"), ("rings", "Rings"), ("tips", "Tips"), ("chevrons", "Chevrons"), ("drops", "Drops")],
    "cuff": [("arrows", "Arrows"), ("scallops", "Scallops"), ("dots", "Dots"), ("beads", "Beads"), ("vineband", "Vine band")],
}

LINE = 6.8          # the vine's stem is 6.8 across, the cuff's rules 8: new lines sit between


# ------------------------------------------------------------------ small helpers
def n1(x):
    s = "%.1f" % x
    if s.endswith(".0"):
        s = s[:-2]
    return "0" if s == "-0" else s


class Frame:
    """A centreline (polyline, image coordinates) with arclength u and a normal v."""

    def __init__(self, pts):
        P = np.array(pts, float)
        t = P[-1] - P[-2]
        self.P = np.vstack([P, P[-1] + t / np.hypot(*t) * 200.0])       # a straight run-on past the end
        d = np.diff(self.P, axis=0)
        self.seg = np.hypot(d[:, 0], d[:, 1])
        self.cum = np.concatenate([[0], np.cumsum(self.seg)])
        self.length = self.cum[-1]
        self.u0 = 0.0                                                     # arclength of u = 0 along P

    @staticmethod
    def straight(a, b=None, d=None):
        a = np.array(a, float)
        d = np.array(d if d is not None else np.array(b, float) - a, float)
        d /= np.hypot(*d)
        f = Frame([a - d * 3000.0, a + d * 3000.0])         # runs both ways, so u may be negative
        f.u0 = 3000.0
        return f

    def at(self, u):
        u = u + self.u0
        i = int(np.clip(np.searchsorted(self.cum, u, side="right") - 1, 0, len(self.seg) - 1))
        t = (u - self.cum[i]) / self.seg[i]
        p = self.P[i] + (self.P[i + 1] - self.P[i]) * t
        # tangent: averaged over a short window so a bend is smooth
        a = self._p(u - 6)
        b = self._p(u + 6)       # (u already includes u0 here)
        d = b - a
        return p, d / np.hypot(*d)

    def _p(self, u):
        u = float(np.clip(u, 0, self.length))
        i = int(np.clip(np.searchsorted(self.cum, u, side="right") - 1, 0, len(self.seg) - 1))
        return self.P[i] + (self.P[i + 1] - self.P[i]) * ((u - self.cum[i]) / self.seg[i])

    def pt(self, u, v):
        p, t = self.at(u)
        return p + np.array([-t[1], t[0]]) * v


def quad_curve(p0, c, p2, n=60):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * np.array(p0) + 2 * (1 - t) * t * np.array(c) + t ** 2 * np.array(p2)


class Ink:
    """Collects the shapes of one design, drawn in a Frame's (u, v)."""

    def __init__(self, fr):
        self.fr = fr
        self.out = []

    def P(self, uv):
        x, y = self.fr.pt(*uv)
        return "%s %s" % (n1(x), n1(y))

    def dot(self, u, v, r):
        x, y = self.fr.pt(u, v)
        self.out.append('<circle cx="%s" cy="%s" r="%s"/>' % (n1(x), n1(y), n1(r)))

    def path(self, cmds):
        """cmds: ('M', p) ('L', p) ('C', p1, p2, p3) ('Q', p1, p2) ('Z',) with p = (u, v)."""
        d = []
        for c in cmds:
            d.append(c[0] + (" " + " ".join(self.P(p) for p in c[1:]) if len(c) > 1 else ""))
        self.out.append('<path d="%s"/>' % " ".join(d))

    def poly(self, pts):
        self.path([("M", pts[0])] + [("L", p) for p in pts[1:]] + [("Z",)])

    def smooth_d(self, pts):
        """A closed path through pts: quadratic midpoint smoothing (same trick as twod.smooth)."""
        P = [np.array(self.fr.pt(*p)) for p in pts]
        m0 = (P[0] + P[1]) / 2
        d = ["M %s %s" % (n1(m0[0]), n1(m0[1]))]
        for i in range(1, len(P) - 1):
            m = (P[i] + P[i + 1]) / 2
            d.append("Q %s %s %s %s" % (n1(P[i][0]), n1(P[i][1]), n1(m[0]), n1(m[1])))
        m = (P[-1] + P[0]) / 2
        d.append("Q %s %s %s %s" % (n1(P[-1][0]), n1(P[-1][1]), n1(m[0]), n1(m[1])))
        d.append("Z")
        return " ".join(d)

    def smooth(self, *loops):
        """One path of one or more smoothed closed loops (give a hole the opposite way round)."""
        self.out.append('<path d="%s"/>' % " ".join(self.smooth_d(p) for p in loops))

    def text(self):
        return "\n".join(self.out)


def rot(p, a):
    c, s = math.cos(a), math.sin(a)
    return (p[0] * c - p[1] * s, p[0] * s + p[1] * c)


def rotc(cmds, a):
    return [(c[0],) + tuple(rot(p, a) for p in c[1:]) for c in cmds]


# ------------------------------------------------------------------ measuring the fingers
_mask = {}


def inner_mask():
    """True where there is skin that is not outline: the inside of the hand."""
    if "m" not in _mask:
        from PIL import Image
        import skintones as ST
        g = np.array(Image.open(OH.SRC).convert("L"))
        _mask["m"] = ST.skin_mask(OH.SRC) & ~(g < 200)
    return _mask["m"]


def clearance(fr, u, side, maxd=100):
    """Distance from the centreline at u to the outline, going out on one side."""
    m = inner_mask()
    p, t = fr.at(u)
    n = np.array([-t[1], t[0]]) * side
    for s in range(0, maxd):
        x, y = p + n * s
        xi, yi = int(round(x)), int(round(y))
        if not (0 <= xi < m.shape[1] and 0 <= yi < m.shape[0]) or not m[yi, xi]:
            return s
    return maxd


class Digit:
    """One finger or the thumb: its frame, how wide it is, where the nail starts."""
    MARGIN = 5.5        # clearance kept to the outline; the vines leave 2 to 7

    def __init__(self, name):
        self.name = name
        a, b, n, sc = OH.VINES[name]
        a, b = np.array(a), np.array(b)
        self.L = float(np.hypot(*(b - a)))                  # knuckle to the vine's end
        self.leaf = sc
        u0 = (b - a) / self.L
        if name == "thumb":
            # the thumb bends toward its nail: a quadratic through the knuckle, along the vine's
            # line, to where the midline reaches just under the nail
            self.fr = Frame(quad_curve(a, a + u0 * 70.0, np.array([838.0, 655.0]), 80))
        else:
            self.fr = Frame.straight(a, b)
        self._measure()
        # lay the digit's frame on the middle of the finger as drawn: fit the midline measured
        # between the outline's two sides (the vines' own lines are up to 4 px off it)
        us = np.arange(24.0, self.nail_u - 28.0, 3.0)
        mid = np.array([self.fr.pt(u, self.off(u)) for u in us])
        deg = 2 if name == "thumb" else 1
        cx, cy = np.polyfit(us, mid[:, 0], deg), np.polyfit(us, mid[:, 1], deg)
        g = np.arange(-10.0, self.nail_u + 90.0, 2.0)
        P = np.stack([np.polyval(cx, g), np.polyval(cy, g)], 1)
        self.fr = Frame(P[5:])                                   # P[5] is u = 0, the knuckle
        self._measure()

    def _measure(self):
        m = inner_mask()
        u = self.L - 20.0
        while True:                                          # first outline stroke up the middle: the nail's cuticle
            x, y = self.fr.pt(u, 0)
            if not m[int(round(y)), int(round(x))]:
                break
            u += 1.0
        self.nail_u = u + 9.0                                # the nail's own edge (the vine ends 50 px short of it)
        self.u_end = self.nail_u - 20.0                      # the bud's reach: where designs stop
        us = np.arange(0, self.nail_u + 1, 2.0)
        self._us = us
        l = np.array([clearance(self.fr, u, 1) for u in us], float)
        r = np.array([clearance(self.fr, u, -1) for u in us], float)
        raw = np.minimum(l, r)
        k = 3                                                # narrowest of a short window: never meet a dip
        pad = np.pad(raw, k, mode="edge")
        self._hw = np.array([pad[i:i + 2 * k + 1].min() for i in range(len(raw))]) - self.MARGIN
        self._off = (l - r) / 2
        while self.hw(self.u_end) < 18.0:                    # the thumb's tip bends away from its midline: stop where it is still wide
            self.u_end -= 2.0

    def hw(self, u):
        """Usable half-width at u (outline clearance less the margin)."""
        return float(np.interp(u, self._us, self._hw))

    def hwr(self, u0, u1):
        """The narrowest usable half-width anywhere from u0 to u1."""
        us = np.linspace(u0, u1, 9)
        return min(self.hw(u) for u in us)

    def off(self, u):
        """How far the centreline is off the finger's middle (positive = +v)."""
        return float(np.interp(u, self._us, self._off))


_digits = {}


def digit(name):
    if name not in _digits:
        _digits[name] = Digit(name)
    return _digits[name]


# ------------------------------------------------------------------ fingers
def f_vines(name):
    a, b, n, sc = OH.VINES[name]
    return OH.vine(a, b, n, sc)


def capsule_cmds(u, hw, th):
    """A bar across the finger: v in [-hw, hw], thickness th along u, round ends."""
    r = th / 2
    k = 0.5523 * r
    return [("M", (u - r, -hw + r)),
            ("C", (u - r, -hw + r - k), (u - k, -hw), (u, -hw)),
            ("C", (u + k, -hw), (u + r, -hw + r - k), (u + r, -hw + r)),
            ("L", (u + r, hw - r)),
            ("C", (u + r, hw - r + k), (u + k, hw), (u, hw)),
            ("C", (u - k, hw), (u - r, hw - r + k), (u - r, hw - r)),
            ("Z",)]


def f_rings(name):
    """Three thin bands at the knuckle creases, a row of tiny dots beside each."""
    D = digit(name)
    ink = Ink(D.fr)
    for f in (0.12, 0.47, 0.82):
        u = f * D.u_end
        hw = D.hwr(u - 4, u + 4) * 0.97
        ink.path(capsule_cmds(u, hw, 7.2))
        dh = D.hwr(u + 8, u + 20)
        nd = 5 if dh > 26 else 4
        w = min(hw, dh) * 0.66
        for k in range(nd):
            ink.dot(u + 14.0, -w + 2 * w * k / (nd - 1), 3.1)
    return ink.text()


_vec = {}


def vec_paths():
    """The open hand's traced skin and line art (app/src/art/handVectors.json), 1024 x 1536."""
    if "p" not in _vec:
        import json
        p = os.path.join(HERE, "..", "..", "app", "src", "art", "handVectors.json")
        _vec["p"] = json.load(open(p))["openHand"]
    return _vec["p"]


def vec_mask(path, box, sc):
    import io, subprocess
    from PIL import Image
    x0, y0, w, h = box
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s %s %s %s"><path d="%s" fill="#000" fill-rule="evenodd"/></svg>'
           % (x0, y0, w, h, path))
    out = subprocess.run(["rsvg-convert", "-w", str(w * sc)], input=svg.encode(), capture_output=True, check=True).stdout
    return np.array(Image.open(io.BytesIO(out)).convert("RGBA"))[:, :, 3] > 127


def erode_disk(m, r):
    """m eroded by a disk of radius r (pixels), by FFT convolution."""
    h, w = m.shape
    k = int(math.ceil(r))
    yy, xx = np.mgrid[-k:k + 1, -k:k + 1]
    disk = (xx * xx + yy * yy <= r * r).astype(float)
    H, W = h + 2 * k + 1, w + 2 * k + 1
    f = np.fft.irfft2(np.fft.rfft2((~m).astype(float), (H, W)) * np.fft.rfft2(disk, (H, W)), (H, W))
    near_bad = f[k:k + h, k:k + w] > 0.5                  # some off-pixel within r
    return m & ~near_bad


def component(m, seed):
    """The connected piece of mask m that holds seed = (x, y) (4-connected)."""
    from collections import deque
    out = np.zeros(m.shape, bool)
    q = deque([seed])
    out[seed[1], seed[0]] = True
    h, w = m.shape
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and m[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((nx, ny))
    return out


def f_tips(name):
    """Henna 'dipped' fingertip: the pad below and around the nail, following the finger's own outline.

    Inset 5.5 px from the outline and 5.5 px from the nail's line, cut off below by three
    scallops, with a dot under the middle one. Cut from the traced vector hand at 4x.
    """
    import export_app as EA
    D = digit(name)
    ink_u = D.nail_u - 9.0                                  # where the nail's line starts, up the middle
    sc, inset = 4, 5.5
    cx, cy = D.fr.pt(ink_u, 0)
    box = (int(cx - 110), int(cy - 110), 220, 220)
    vp = vec_paths()
    skin = vec_mask(vp["skin"], box, sc)
    line = vec_mask(vp["ink"], box, sc)
    free = erode_disk(skin & ~line, inset * sc)             # clear of the outline and of the nail's line
    # (u, v) of every free pixel, from the digit's frame
    ys, xs = np.nonzero(free)
    pts = np.stack([xs + 0.5, ys + 0.5], 1) / sc + np.array(box[:2])
    us = np.arange(max(0.0, ink_u - 160), ink_u + 70, 0.5)
    Q = np.array([D.fr.pt(u, 0) for u in us])
    N = np.array([[-D.fr.at(u)[1][1], D.fr.at(u)[1][0]] for u in us])
    uu = np.empty(len(pts)); vv = np.empty(len(pts))
    for j in range(0, len(pts), 20000):
        P = pts[j:j + 20000]
        d2 = ((P[:, None, :] - Q[None, :, :]) ** 2).sum(2)
        k = d2.argmin(1)
        uu[j:j + 20000] = us[k]
        vv[j:j + 20000] = ((P - Q[k]) * N[k]).sum(1)
    # the cut: three scallops across the finger, each a semicircle bulging toward the knuckle
    pad_top = ink_u - inset
    base = pad_top - 38.0
    hwb = D.hwr(base - 12, base + 4) + D.MARGIN - inset       # the free half-width at the cut
    n = 3
    sr = hwb / n
    vc = -hwb + sr * (2 * np.arange(n) + 1)
    idx = np.clip(np.round((vv + hwb - sr) / (2 * sr)).astype(int), 0, n - 1)
    bulge = np.sqrt(np.maximum(sr * sr - (vv - vc[idx]) ** 2, 0.0))
    keep = uu >= base - bulge
    cap = np.zeros(free.shape, bool)
    cap[ys[keep], xs[keep]] = True
    # only the pad: the piece of it touching the point just below the nail
    sx, sy = D.fr.pt(ink_u - 14.0, 0)
    seed = (int((sx - box[0]) * sc), int((sy - box[1]) * sc))
    assert cap[seed[1], seed[0]], "tip seed is outside the pad: " + name
    cap = component(cap, seed)
    pts = EA.trace_outer(cap)
    pts = EA.dp(pts + [pts[0]], 1.1)[:-1]
    ink = flat()
    ink.poly([(box[0] + x / sc, box[1] + y / sc) for x, y in pts])
    below = base - sr - 15.0                                  # the dot, under the middle scallop
    dx, dy = D.fr.pt(below, 0)
    ink.dot(dx, dy, 4.8)
    return ink.text()


def chevron(ink, u, w, h, t):
    """A thick V pointing along +u: apex at u + h, arms back to u at v = +-w."""
    ink.poly([(u, -w), (u + h, 0), (u, w), (u - t, w), (u + h - t, 0), (u - t, -w)])


def f_chevrons(name):
    """A column of small nested V shapes, all pointing to the tip."""
    D = digit(name)
    ink = Ink(D.fr)
    u0, u1 = 38.0, D.u_end - 26.0
    n = max(3, int(round((u1 - u0) / 46.0)) + 1)
    for i in range(n):
        u = u0 + (u1 - u0) * i / (n - 1)
        hw = D.hwr(u - 6, u + 0.7 * D.hw(u)) * 0.88
        h = hw * 0.72
        chevron(ink, u, hw, h, 6.6)
        w2 = hw * 0.52
        h2 = w2 * 0.70
        chevron(ink, u + h - 6.6 - 5.5 - h2, w2, h2, 5.2)
    return ink.text()


def teardrop_cmds(u, v, ln, wd):
    """A drop whose round end is at u and whose point is at u + ln."""
    r, k = wd / 2, 0.5523
    return [("M", (u, v - r)),
            ("C", (u + r * 0.2, v - r), (u + ln * 0.55, v - r * 0.55), (u + ln, v)),
            ("C", (u + ln * 0.55, v + r * 0.55), (u + r * 0.2, v + r), (u, v + r)),
            ("C", (u - r * k, v + r), (u - r, v + r * k), (u - r, v)),
            ("C", (u - r, v - r * k), (u - r * k, v - r), (u, v - r)),
            ("Z",)]


def f_drops(name):
    """A column of small teardrops with a dot between each, ending in a dot near the tip."""
    D = digit(name)
    ink = Ink(D.fr)
    u0 = 28.0
    last = D.u_end - 2.0
    while D.hw(last) < 8.5:                         # the thumb's tip bends away: stop short of the nail's lobe
        last -= 2.0
    n = max(2, int(round((last - 22 - u0) / 50.0)))
    step = (last - 22 - u0) / n
    for i in range(n):
        u = u0 + step * i
        wd = min(18.0, D.hwr(u, u + step) * 0.55)
        ink.path(teardrop_cmds(u + wd / 2, 0, step * 0.56, wd))
        ink.dot(u + step * 0.56 + wd / 2 + (step - step * 0.56 - wd / 2) * 0.5, 0, 3.1)
    ink.dot(last, 0, 5.4)
    return ink.text()


FINGER = {"vines": f_vines, "rings": f_rings, "tips": f_tips, "chevrons": f_chevrons, "drops": f_drops}


# ------------------------------------------------------------------ cuff
def cuff_box():
    y0, y1 = OH.CUFF
    xl = max(OH.WRIST[y0][0], OH.WRIST[y1][0]) + 18
    xr = min(OH.WRIST[y0][1], OH.WRIST[y1][1]) - 18
    return xl, xr, y0, y1


def flat():
    """Plain image coordinates: u is x, v is y."""
    return Ink(Frame.straight((0, 0), d=(1, 0)))


def c_arrows():
    return OH.cuff()


def c_scallops():
    """A rule, then a row of semicircle scallops hanging from it, a dot in each."""
    xl, xr, y0, y1 = cuff_box()
    ink = flat()
    yr = y0 + 14.0
    ink.poly([(xl, yr), (xr, yr), (xr, yr + 7), (xl, yr + 7)])
    n = 7
    pitch = (xr - xl) / n
    R, th = pitch / 2, 6.4
    ys = yr + 7
    k = 0.5523
    for i in range(n):
        xc = xl + pitch * (i + 0.5)
        ro, ri = R, R - th
        ink.path([("M", (xc - ro, ys)),
                  ("C", (xc - ro, ys + ro * k), (xc - ro * k, ys + ro), (xc, ys + ro)),
                  ("C", (xc + ro * k, ys + ro), (xc + ro, ys + ro * k), (xc + ro, ys)),
                  ("L", (xc + ri, ys)),
                  ("C", (xc + ri, ys + ri * k), (xc + ri * k, ys + ri), (xc, ys + ri)),
                  ("C", (xc - ri * k, ys + ri), (xc - ri, ys + ri * k), (xc - ri, ys)),
                  ("Z",)])
        ink.dot(xc, ys + ri * 0.42, 4.4)
    return ink.text()


def c_dots():
    """Two thin parallel lines with a row of dots between."""
    xl, xr, y0, y1 = cuff_box()
    ink = flat()
    ya, yb = y0 + 11.0, y1 - 16.0
    for y in (ya, yb):
        ink.poly([(xl, y), (xr, y), (xr, y + 5), (xl, y + 5)])
    n = 13
    pitch = (xr - xl - 14) / (n - 1)
    ym = (ya + yb + 5) / 2
    for i in range(n):
        ink.dot(xl + 7 + pitch * i, ym, 5.2)
    return ink.text()


def c_beads():
    """A chain of small circles and diamonds, alternating, on a fine thread."""
    xl, xr, y0, y1 = cuff_box()
    ink = flat()
    ym = (y0 + y1) / 2
    n = 11
    rd = 11.5
    pitch = (xr - xl - 2 * rd) / (n - 1)
    ink.poly([(xl + rd, ym - 1.8), (xr - rd, ym - 1.8), (xr - rd, ym + 1.8), (xl + rd, ym + 1.8)])
    for i in range(n):
        x = xl + rd + pitch * i
        if i % 2 == 0:
            ink.dot(x, ym, 8.6)
        else:
            ink.poly([(x - rd, ym), (x, ym - rd * 1.15), (x + rd, ym), (x, ym + rd * 1.15)])
    return ink.text()


def c_vineband():
    """A vine running across the wrist, small paired leaves growing out from the middle."""
    xl, xr, y0, y1 = cuff_box()
    ym = (y0 + y1) / 2
    cx = (xl + xr) / 2
    o = ['<path d="M %s %s L %s %s L %s %s L %s %s Z"/>'
         % (n1(xl), n1(ym - 3.4), n1(xr), n1(ym - 3.4), n1(xr), n1(ym + 3.4), n1(xl), n1(ym + 3.4))]
    pitch, s = 31.0, 1.9
    for side, ang in ((1, 90), (-1, -90)):
        for i in range(4):
            x = cx + side * (22 + pitch * i)
            o.append('<g transform="translate(%s %s) rotate(%d) scale(%s)"><use href="#lf"/><use href="#rf"/></g>'
                     % (n1(x), n1(ym), ang, n1(s)))
    o.append('<path d="M %s %s L %s %s L %s %s L %s %s Z"/>'
             % (n1(cx - 12), n1(ym), n1(cx), n1(ym - 12), n1(cx + 12), n1(ym), n1(cx), n1(ym + 12)))
    return "\n".join(o)


CUFF = {"arrows": c_arrows, "scallops": c_scallops, "dots": c_dots, "beads": c_beads, "vineband": c_vineband}


# ------------------------------------------------------------------ gol (the back of the hand)
def gol_ink():
    cx, cy, R = OH.MANDALA
    return Ink(Frame.straight((cx, cy), d=(1, 0)))      # u is x, v is y, from the medallion's centre


def g_bloom():
    cx, cy, R = OH.MANDALA
    return SB.gol(cx, cy, R)


def petal_cmds(r0, r1, w, flip=False, base=1.30, mid=1.35):
    """A pointed petal along -y: base at radius r0, tip at r1, w about the half-width. flip winds it the other way."""
    L = r1 - r0
    sx = -1 if flip else 1
    P = lambda x, y: (sx * x, y)
    right = [("C", P(w * base, -r0 - 0.08 * L), P(w * mid, -r0 - 0.50 * L), P(0.0, -r1))]
    left = [("C", P(-w * mid, -r0 - 0.50 * L), P(-w * base, -r0 - 0.08 * L), P(0.0, -r0))]
    return [("M", P(0, -r0))] + right + left + [("Z",)]


def shift(cmds, dx, dy):
    return [(c[0],) + tuple((p[0] + dx, p[1] + dy) for p in c[1:]) for c in cmds]


def ring_cmds(r0, r1, w, t):
    """A petal outline of weight t: the petal, then the same petal smaller and wound the other way."""
    return petal_cmds(r0, r1, w) + petal_cmds(r0 + 1.3 * t, r1 - 2.0 * t, w - t, flip=True)


def g_lotus():
    """Layered lotus: outlined petals behind, solid petals in front, a dotted heart, a ring of dots."""
    ink = gol_ink()
    q = 0.925                                                             # keeps the ring of dots inside the bloom's reach
    for k in range(8):
        a = math.radians(k * 45)
        ink.path(rotc(ring_cmds(66 * q, 180 * q, 29 * q, 6.6), a))        # back row: outlined petals
        ink.path(rotc(petal_cmds(112 * q, 148 * q, 9.5 * q), a))          # a bud inside each
    for k in range(8):
        a = math.radians(22.5 + k * 45)
        ink.path(rotc(petal_cmds(22 * q, 114 * q, 15.5 * q, base=0.35, mid=1.4), a))   # front row, between them
    ink.dot(0, 0, 8.0)
    for k in range(24):
        a = math.radians(k * 15 + 7.5)
        ink.dot(182 * math.cos(a), 182 * math.sin(a), 3.3)
    return ink.text()


def circle_cmds(r, cx=0.0, cy=0.0, rev=False):
    k = 0.5523 * r
    pts = [("M", (cx + r, cy)),
           ("C", (cx + r, cy + k), (cx + k, cy + r), (cx, cy + r)),
           ("C", (cx - k, cy + r), (cx - r, cy + k), (cx - r, cy)),
           ("C", (cx - r, cy - k), (cx - k, cy - r), (cx, cy - r)),
           ("C", (cx + k, cy - r), (cx + r, cy - k), (cx + r, cy)), ("Z",)]
    if rev:
        pts = [("M", (cx + r, cy)),
               ("C", (cx + r, cy - k), (cx + k, cy - r), (cx, cy - r)),
               ("C", (cx - k, cy - r), (cx - r, cy - k), (cx - r, cy)),
               ("C", (cx - r, cy + k), (cx - k, cy + r), (cx, cy + r)),
               ("C", (cx + k, cy + r), (cx + r, cy + k), (cx + r, cy)), ("Z",)]
    return pts


def ring_circle(r, t):
    return circle_cmds(r) + circle_cmds(r - t, rev=True)


def place(cmds, r0, ang):
    """Move cmds (drawn along +x from the origin) out to radius r0 along angle ang."""
    return rotc(shift(cmds, r0, 0.0), ang)


def g_sunburst():
    ink = gol_ink()
    ink.path(ring_circle(50, 8.5))
    ink.path(circle_cmds(26))
    for k in range(16):
        a = math.radians(k * 22.5)
        if k % 2 == 0:
            ink.path(place(teardrop_cmds(10, 0, 98, 21), 58, a))
        else:
            ink.path(place(teardrop_cmds(8, 0, 58, 15), 58, a))
            b = 58 + 8 + 58 + 14
            ink.dot(b * math.cos(a), b * math.sin(a), 3.4)
    for k in range(32):
        a = math.radians(k * 11.25 + 5.625 * 0)
        ink.dot(178 * math.cos(a), 178 * math.sin(a), 3.5)
    return ink.text()


def g_jaali():
    ink = gol_ink()
    Rb, th, N = 142.0, 7.0, 20
    ink.path(ring_circle(Rb + th / 2, th))
    # scalloped edge: a semicircular ring on every chord of the boundary, bulging outward
    k = 0.5523
    half = math.pi / N
    rho = Rb * math.sin(half)
    for i in range(N):
        phi = (i + 0.5) * 2 * half
        mx, my = Rb * math.cos(half) * math.cos(phi), Rb * math.cos(half) * math.sin(phi)
        ex, ey = math.cos(phi), math.sin(phi)               # outward
        tx, ty = -ey, ex                                    # along the chord
        def pt(a, b, rr):                                   # a along the chord, b outward, radius rr
            return (mx + tx * a * rr + ex * b * rr, my + ty * a * rr + ey * b * rr)
        ro, ri = rho + th / 2, rho - th / 2
        ink.path([("M", pt(-1, 0, ro)),
                  ("C", pt(-1, k, ro), pt(-k, 1, ro), pt(0, 1, ro)),
                  ("C", pt(k, 1, ro), pt(1, k, ro), pt(1, 0, ro)),
                  ("L", pt(1, 0, ri)),
                  ("C", pt(1, k, ri), pt(k, 1, ri), pt(0, 1, ri)),
                  ("C", pt(-k, 1, ri), pt(-1, k, ri), pt(-1, 0, ri)),
                  ("Z",)])
    # the net: two families of lines at 45 degrees, spaced d apart, clipped to the boundary
    d, lw, Rin = 47.0, 5.6, Rb - 1.0
    for fam in (0, 1):
        ang = math.radians(45 + 90 * fam)
        ex, ey = math.cos(ang), math.sin(ang)               # the line's normal
        tx, ty = -ey, ex
        for j in range(-4, 5):
            s = j * d + d / 2 * 0                           # a line through the origin when j = 0
            if abs(s) >= Rin - 8:
                continue
            h = math.sqrt(Rin * Rin - s * s)
            p0 = (ex * s - tx * h, ey * s - ty * h)
            p1 = (ex * s + tx * h, ey * s + ty * h)
            hx, hy = ex * lw / 2, ey * lw / 2
            ink.poly([(p0[0] - hx, p0[1] - hy), (p1[0] - hx, p1[1] - hy), (p1[0] + hx, p1[1] + hy), (p0[0] + hx, p0[1] + hy)])
    for i in range(-4, 5):                                  # a dot at every crossing, a smaller one in every cell
        for j in range(-4, 5):
            x = (i * d) * math.cos(math.radians(45)) - (j * d) * math.sin(math.radians(45))
            y = (i * d) * math.sin(math.radians(45)) + (j * d) * math.cos(math.radians(45))
            if math.hypot(x, y) < Rb - 16:
                ink.dot(x, y, 7.6)
            cx_, cy_ = (i + 0.5) * d, (j + 0.5) * d
            x = cx_ * math.cos(math.radians(45)) - cy_ * math.sin(math.radians(45))
            y = cx_ * math.sin(math.radians(45)) + cy_ * math.cos(math.radians(45))
            if math.hypot(x, y) < Rb - 22:
                ink.dot(x, y, 3.8)
    return ink.text()



def g_paisley():
    """One large boteh, leaning, with an inner line, a curl and a filling of dots, and a few dots around."""
    ink = gol_ink()
    ss = np.linspace(0, 1, 120)
    K = 1.30
    LS = 300.0 * K
    hd = np.radians(-90 + 50 * ss + 150 * ss ** 3)          # heading: up, curling over to the right at the tip
    sp = np.zeros((len(ss), 2))
    for i in range(1, len(ss)):
        sp[i] = sp[i - 1] + (LS / (len(ss) - 1)) * np.array([math.cos(hd[i]), math.sin(hd[i])])
    nm = np.stack([-np.sin(hd), np.cos(hd)], 1)             # to the right of travel: the curl's inside
    wid = 82.0 * K * np.sin(np.pi * ss ** 0.62) ** 0.9 * (1 - 0.18 * ss)

    tilt = math.radians(-12)
    allp = np.vstack([sp + nm * wid[:, None], sp - nm * wid[:, None]])
    allp = np.array([rot(p, tilt) for p in allp])               # centre it as it will be drawn, tilted
    ctr = rot((allp.min(0) + allp.max(0)) / 2, -tilt)
    T = lambda p: rot((p[0] - ctr[0], p[1] - ctr[1]), tilt)

    def loop(inset, lo, hi, step=4):
        w = np.maximum(wid - inset, 0.0)
        sel = np.nonzero((ss >= lo) & (ss <= hi) & ((w > 3.0) | (inset == 0)))[0][::step]
        Rr = [T(sp[i] - nm[i] * w[i]) for i in sel]
        Ll = [T(sp[i] + nm[i] * w[i]) for i in sel][::-1]
        return Rr + Ll

    # outline of weight 9: the boteh, then the boteh less 9 all round, wound the other way
    ink.smooth(loop(0, 0, 1), loop(9, 0.0, 0.93)[::-1])
    # the inner line, thinner, with a gap inside the outline
    ink.smooth(loop(18, 0.0, 0.84), loop(23.5, 0.0, 0.81)[::-1])
    # the curl in the bulb: a spiral band
    ic = int(0.215 * (len(ss) - 1))
    cxy = T(sp[ic])
    pts_l, pts_r = [], []
    th = np.linspace(0, 1, 40)
    for t in th:
        ang = 2 * math.pi * 1.75 * t + 0.5
        r = 6.0 + 30.0 * t
        # a band of half-weight 3, tapering at the start
        hw_ = 1.6 + 1.6 * t
        for sgn, dst in ((1, pts_l), (-1, pts_r)):
            dst.append((cxy[0] + (r + sgn * hw_) * math.cos(ang), cxy[1] + (r + sgn * hw_) * math.sin(ang)))
    ink.smooth(pts_l + pts_r[::-1])
    ink.dot(cxy[0], cxy[1], 4.4)
    # dots around the curl, inside the inner line
    for k in range(9):
        a = 2 * math.pi * k / 9 + 0.3
        ink.dot(cxy[0] + 47 * math.cos(a), cxy[1] + 47 * math.sin(a), 3.4)
    # a row of dots up the boteh, shrinking toward the tip
    for s_, r_ in ((0.44, 7.4), (0.54, 6.4), (0.63, 5.4), (0.71, 4.4)):
        i = int(s_ * (len(ss) - 1))
        q = T(sp[i])
        ink.dot(q[0], q[1], r_)
    # small dots outside, along the inside of the curl and around the bulb
    for s_, off_, r_ in ((0.10, -1, 4.2), (0.28, -1, 4.0), (0.48, 1, 4.2), (0.62, 1, 3.8), (0.74, 1, 3.4), (0.20, 1, 4.0)):
        i = int(s_ * (len(ss) - 1))
        q = T(sp[i] + nm[i] * off_ * (wid[i] + 26))
        ink.dot(q[0], q[1], r_)
    return ink.text()


GOL = {"bloom": g_bloom, "lotus": g_lotus, "paisley": g_paisley, "sunburst": g_sunburst, "jaali": g_jaali}


# ------------------------------------------------------------------ the public face
def design(section, style):
    """One design as an SVG fragment (no paint)."""
    if section == "gol":
        return GOL[style]()
    if section == "cuff":
        return CUFF[style]()
    return FINGER[style](section)


def style_list(group):
    return [{"id": i, "name": n} for i, n in STYLES[group]]


def all_designs():
    out = {}
    for sec in SECTIONS:
        group = "gol" if sec == "gol" else "cuff" if sec == "cuff" else "finger"
        out[sec] = {i: design(sec, i) for i, n in STYLES[group]}
    return out


def section_hit():
    """A generous tap rectangle per section, [x, y, w, h] in image coordinates."""
    hit = {}
    for name in DIGITS:
        D = digit(name)
        pts = [D.fr.pt(u, v) for u in np.linspace(0, D.nail_u + 62, 12) for v in (-52, 52)]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        hit[name] = [int(min(xs)), int(min(ys)), int(max(xs) - min(xs)), int(max(ys) - min(ys))]
    cx, cy, R = OH.MANDALA
    hit["gol"] = [int(cx - 245), int(cy - 235), 490, 470]
    xl, xr, y0, y1 = cuff_box()
    hit["cuff"] = [int(min(OH.WRIST[y0][0], OH.WRIST[y1][0])), int(y0 - 24), int(max(OH.WRIST[y0][1], OH.WRIST[y1][1]) - min(OH.WRIST[y0][0], OH.WRIST[y1][0])), int(y1 - y0 + 48)]
    return {s: hit[s] for s in SECTIONS}
