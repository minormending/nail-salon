"""Bake the 3D hand down to flat passes. The passes ship; the model does not."""
import numpy as np
from PIL import Image
import model

SS = 2
W, H = 520, 900
WS, HS = W * SS, H * SS
SCALE = 1.80 * SS
FOCAL = 1400.0 * SS          # weak perspective, just enough to give it life

PARTS = ["index", "middle", "ring", "pinky", "thumb"]
PID = {"palm": 1, "index": 2, "middle": 3, "ring": 4, "pinky": 5, "thumb": 6}


def rot(yaw, pitch, roll):
    cy, sy = np.cos(yaw), np.sin(yaw)
    cp, sp = np.cos(pitch), np.sin(pitch)
    cr, sr = np.cos(roll), np.sin(roll)
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
    Rz = np.array([[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]])
    return Rz @ Rx @ Ry


class Buffers:
    def __init__(self):
        self.z = np.full(WS * HS, -1e9, np.float32)
        self.n = np.zeros((WS * HS, 3), np.float32)
        self.uv = np.zeros((WS * HS, 2), np.float32)
        self.pid = np.zeros(WS * HS, np.uint8)

    def splat(self, P, N, U, V, pid):
        """P (M,3) already rotated and centred. Painter's scatter with a z-test."""
        persp = FOCAL / np.maximum(FOCAL - P[:, 2] * SCALE, 1.0)
        sx = WS * 0.5 + P[:, 0] * SCALE * persp
        sy = HS * 0.5 + P[:, 1] * SCALE * persp
        ix = np.rint(sx).astype(np.int64)
        iy = np.rint(sy).astype(np.int64)
        ok = (ix >= 0) & (ix < WS) & (iy >= 0) & (iy < HS) & (N[:, 2] > -0.04)
        if not ok.any():
            return
        ix, iy, P, N, U, V = ix[ok], iy[ok], P[ok], N[ok], U[ok], V[ok]
        idx = iy * WS + ix
        z = P[:, 2]
        order = np.argsort(z, kind="stable")
        idx, z, N, U, V = idx[order], z[order], N[order], U[order], V[order]
        keep = z > self.z[idx]
        idx, z, N, U, V = idx[keep], z[keep], N[keep], U[keep], V[keep]
        self.z[idx] = z
        self.n[idx] = N
        self.uv[idx, 0] = U
        self.uv[idx, 1] = V
        self.pid[idx] = pid


def bake(yaw=0.0, pitch=0.0, roll=0.0, curl=0.0, mirror=False):
    R = rot(np.radians(yaw), np.radians(pitch), np.radians(roll))
    pivot = np.array([150.0, 282.0, 10.0])
    buf = Buffers()

    # ---- fingers and thumb -------------------------------------------------
    for name in PARTS:
        spine = [list(p) for p in model.DIGITS[name]]
        if curl and name != "thumb":                      # bend the tips forward
            for i, p in enumerate(spine):
                w = (i / (len(spine) - 1)) ** 1.7
                p[1] += curl * 16.0 * w
                p[2] += curl * 13.0 * w
        rg = model.rings(spine)
        u0, u1, v0, v1 = model.ATLAS[name]
        arc = rg["s"] / rg["s"][-1]
        n_around = max(96, int(2.6 * 2 * np.pi * rg["R"].max() * SCALE))
        theta = np.linspace(0, 2 * np.pi, n_around, endpoint=False)
        ct, st = np.cos(theta)[None, :, None], np.sin(theta)[None, :, None]
        ul = (theta / (2 * np.pi) + 0.5) % 1.0            # 0.5 == back of the finger
        step = max(1, int(len(rg["C"]) / 24))
        for a in range(0, len(rg["C"]), step):
            sl = slice(a, min(a + step + 1, len(rg["C"])))
            C, Rr = rg["C"][sl][:, None, :], rg["R"][sl][:, None, None]
            Nf, Bf, Tf = rg["N"][sl][:, None, :], rg["B"][sl][:, None, :], rg["T"][sl][:, None, :]
            radial = ct * Nf + st * Bf
            pts = C + Rr * radial
            nrm = rg["ar"][sl][:, None, None] * radial + rg["at"][sl][:, None, None] * Tf
            nrm /= np.linalg.norm(nrm, axis=2, keepdims=True) + 1e-9
            m = pts.shape[0] * pts.shape[1]
            P = ((pts.reshape(m, 3) - pivot) @ R.T).astype(np.float32)
            N = (nrm.reshape(m, 3) @ R.T).astype(np.float32)
            if mirror:
                P[:, 0] *= -1.0
                N[:, 0] *= -1.0
            U = np.tile(u0 + ul * (u1 - u0), (pts.shape[0], 1)).reshape(m).astype(np.float32)
            V = np.repeat(v0 + arc[sl] * (v1 - v0), n_around).astype(np.float32)
            buf.splat(P, N, U, V, PID[name])

    # ---- palm --------------------------------------------------------------
    u0, u1, v0, v1 = model.ATLAS["palm"]
    gx = np.linspace(60, 244, int(184 * SCALE * 1.7))
    gy = np.linspace(186, 482, int(296 * SCALE * 1.9))
    for a in range(0, len(gy), 180):
        Y, X = np.meshgrid(gy[a:a + 181], gx, indexing="ij")
        inside, dx, half, Z = model.palm_fields(X, Y)
        e = 1e-2
        _, _, _, Zx = model.palm_fields(X + e, Y)
        _, _, _, Zy = model.palm_fields(X, Y + e)
        nrm = np.stack([-(Zx - Z) / e, -(Zy - Z) / e, np.ones_like(Z)], -1)
        nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
        sel = inside
        pts = np.stack([X[sel], Y[sel], Z[sel]], -1)
        P = ((pts - pivot) @ R.T).astype(np.float32)
        N = (nrm[sel] @ R.T).astype(np.float32)
        if mirror:
            P[:, 0] *= -1.0
            N[:, 0] *= -1.0
        U = (u0 + (0.5 + dx[sel] / 2) * (u1 - u0)).astype(np.float32)
        V = (v0 + np.clip((Y[sel] - 186) / 298, 0, 1) * (v1 - v0)).astype(np.float32)
        buf.splat(P, N, U, V, PID["palm"])

    mask = (buf.pid > 0).reshape(HS, WS)
    return dict(mask=mask,
                z=buf.z.reshape(HS, WS),
                n=buf.n.reshape(HS, WS, 3),
                uv=buf.uv.reshape(HS, WS, 2),
                pid=buf.pid.reshape(HS, WS))


def boxblur(a, r):
    if r < 1:
        return a
    pad = np.pad(a, ((r, r), (r, r)), mode="edge")
    c = np.cumsum(np.cumsum(pad, 0), 1)
    c = np.pad(c, ((1, 0), (1, 0)))
    k = 2 * r + 1
    s = (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k])
    return s / (k * k)


def ao_pass(z, mask):
    """Screen-space AO.

    Two terms. Cavity: neighbouring *surface* sits in front of me, which finds
    the knuckle junction and the valleys between fingers. Contour: background
    nearby, which darkens silhouettes the way a real form does. Averaging
    against the empty background instead of against covered pixels is what made
    the first attempt come out blank.
    """
    m = mask.astype(np.float32)
    zm = z * m
    cav = np.zeros_like(zm)
    for r, w, k in ((2 * SS, 0.26, 3.0), (5 * SS, 0.30, 5.0),
                    (13 * SS, 0.26, 8.5), (28 * SS, 0.18, 13.0)):
        cov = np.maximum(boxblur(m, r), 1e-4)
        zb = boxblur(zm, r) / cov
        cav += w * np.clip((zb - z) / k, 0, 1) * np.clip(cov * 1.6, 0, 1)
    con = np.zeros_like(zm)
    for r, w in ((4 * SS, 0.40), (12 * SS, 0.36), (28 * SS, 0.24)):
        con += w * boxblur(1.0 - m, r)
    return np.clip(1.0 - 1.15 * cav - 0.62 * con, 0.17, 1.0) * m
