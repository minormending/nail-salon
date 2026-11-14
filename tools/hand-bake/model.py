"""The hand as a 3D model: five generalized cylinders plus a domed palm.

Nothing here ships. This exists only to bake flat passes the app can sample.
"""
import numpy as np

# ---------------------------------------------------------------- splines

def catmull(pts, n=20):
    P = np.asarray(pts, float)
    ext = np.vstack([P[0] + (P[0] - P[1]), P, P[-1] + (P[-1] - P[-2])])
    out = []
    for i in range(len(P) - 1):
        p0, p1, p2, p3 = ext[i], ext[i + 1], ext[i + 2], ext[i + 3]
        t = np.linspace(0, 1, n, endpoint=False)[:, None]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t
                          + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-1][None, :])
    return np.vstack(out)


def frames(C):
    """Parallel-transport frames, so the texture does not twist along the tube."""
    T = np.gradient(C, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-9
    N = np.zeros_like(T)
    ref = np.array([0.0, 0.0, 1.0])
    n0 = ref - T[0] * np.dot(ref, T[0])
    if np.linalg.norm(n0) < 1e-6:
        n0 = np.array([1.0, 0.0, 0.0]) - T[0] * T[0][0]
    N[0] = n0 / np.linalg.norm(n0)
    for i in range(1, len(T)):
        v = N[i - 1] - T[i] * np.dot(N[i - 1], T[i])
        nv = np.linalg.norm(v)
        N[i] = v / nv if nv > 1e-9 else N[i - 1]
    B = np.cross(T, N)
    return T, N, B


def rings(spine, cap_steps=28, spacing=0.10):
    """Return per-ring centre, radius, frame and arc-length, with a hemisphere cap.

    `spacing` is in model units and must be well under one output pixel, or the
    tube bands.
    """
    P = np.asarray(spine, float)
    rough = np.linalg.norm(np.diff(P[:, :3], axis=0), axis=1).sum()
    dens = max(20, int(rough / spacing / (len(P) - 1)))
    S = catmull(spine, dens)
    C, R = S[:, :3], S[:, 3]
    T, N, B = frames(C)
    seg = np.linalg.norm(np.diff(C, axis=0), axis=1)
    s = np.concatenate([[0.0], np.cumsum(seg)])
    drds = np.gradient(R) / (np.gradient(s) + 1e-9)
    ar = np.ones_like(R)
    at = -drds

    r0, c0, t0, n0, b0 = R[-1], C[-1], T[-1], N[-1], B[-1]
    phi = np.linspace(0, np.pi / 2, cap_steps + 1)[1:]
    cc = c0[None, :] + t0[None, :] * (r0 * np.sin(phi))[:, None]

    return dict(
        C=np.vstack([C, cc]),
        R=np.concatenate([R, r0 * np.cos(phi)]),
        N=np.vstack([N, np.repeat(n0[None, :], cap_steps, 0)]),
        B=np.vstack([B, np.repeat(b0[None, :], cap_steps, 0)]),
        T=np.vstack([T, np.repeat(t0[None, :], cap_steps, 0)]),
        ar=np.concatenate([ar, np.cos(phi)]),
        at=np.concatenate([at, np.sin(phi)]),
        s=np.concatenate([s, s[-1] + r0 * phi]),
    )


# ---------------------------------------------------------------- the hand
# x right, y down (matching the SVG board), z toward the viewer.
# Each digit runs base -> tip. The first ring sits under the palm dome so the
# knuckle junction is hidden rather than seamed.

DIGITS = {
    "index":  [(84, 248,  1, 15.5), (84, 214, 23, 15.2), (84, 172, 19, 14.2),
               (84, 122, 12, 13.2), (84.5, 82,  4, 12.0)],
    "middle": [(126, 250, 1, 16.0), (126, 214, 24, 15.6), (126, 166, 20, 14.6),
               (126, 112, 12, 13.6), (126,  58,  3, 12.4)],
    "ring":   [(171, 248, 1, 15.4), (171, 213, 23, 15.0), (171, 166, 19, 14.0),
               (171.5, 118, 11, 13.0), (171.5, 71, 2, 11.9)],
    "pinky":  [(218, 250, 1, 13.6), (218, 222, 20, 13.2), (218, 190, 16, 12.4),
               (218, 160, 10, 11.5), (218, 128,  2, 10.6)],
    # the thumb leaves the radial EDGE of the palm, not the front of it
    "thumb":  [(104, 424, -4, 31.0), (90, 398, 5, 29.0), (72, 360, 11, 27.0),
               (52, 322, 12, 24.5), (34, 296,  8, 22.5), (25, 280, 3, 21.3)],
}

# atlas: palm across the top half, five finger strips below
# Regions are sized so a circle drawn in the atlas stays a circle on the hand.
# The back of the hand is ~180 x 298 model units, so its patch is 0.45 x 0.745.
# The finger strips are deliberately stretched ~2x along their length: that is
# where the detail goes, and henna on a finger is a linear motif anyway.
ATLAS = {
    "palm":   (0.020, 0.470, 0.240, 0.985),
    "index":  (0.510, 0.598, 0.020, 0.440),
    "middle": (0.608, 0.696, 0.020, 0.440),
    "ring":   (0.706, 0.794, 0.020, 0.440),
    "pinky":  (0.804, 0.892, 0.020, 0.440),
    "thumb":  (0.902, 0.990, 0.020, 0.440),
}

PALM_PROFILE = [(190, 82, 152), (222, 89, 152), (258, 91, 151), (296, 90, 150),
                (334, 86, 149), (368, 78, 148), (398, 68, 147), (424, 58, 146),
                (450, 52, 146), (480, 50, 146)]

KNUCKLES = ((84.0, 196.0), (126.0, 192.0), (171.0, 195.0), (218.0, 212.0))


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def palm_top(X):
    """Scalloped upper edge: it rides up at each knuckle and dips at each web."""
    peak = np.zeros_like(X)
    for kx, ky in KNUCKLES:
        peak = np.maximum(peak, (236.0 - ky) * np.exp(-((X - kx) / 21.0) ** 2))
    web = 236.0 - peak
    # the first web space, between thumb and index, sits much lower
    return web + 26.0 * smoothstep(84.0, 46.0, X) + 10.0 * smoothstep(218.0, 244.0, X)


def palm_fields(X, Y):
    """Half-width, centre and dome height for the back of the hand at each (x, y).

    Every falloff here is a smoothstep. A bare np.clip leaves a kink in the
    derivative, and the normals are a derivative, so a clip shows up as a hard
    seam straight across the hand.
    """
    P = np.asarray(PALM_PROFILE, float)
    a = np.interp(Y, P[:, 0], P[:, 1])
    cx = np.interp(Y, P[:, 0], P[:, 2])
    dx = (X - cx) / a
    top = palm_top(X)
    inside = (np.abs(dx) <= 1.0) & (Y >= top)

    dome = np.clip(1.0 - dx ** 2, 0, 1) ** 0.55
    wrist = 1.0 - 0.42 * smoothstep(356.0, 452.0, Y)
    lip = smoothstep(0.0, 20.0, Y - top)          # taper into the webbing
    # metacarpals: four soft ridges running from each knuckle down the hand
    meta = np.zeros_like(X)
    for kx, _ in KNUCKLES:
        run = smoothstep(330.0, 236.0, Y)
        meta += 0.085 * run * np.exp(-((X - kx) / 15.0) ** 2)
    hollow = -0.06 * np.exp(-((X - 150.0) / 46.0) ** 2) * smoothstep(240.0, 310.0, Y)
    z = 2.0 + 13.5 * dome * wrist * lip * (1.0 + meta + hollow)
    return inside, dx, a, z
