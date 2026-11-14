"""The Mela treatment, applied to the same bake.

Mela's rules, read off the board: flat fills, no gradient anywhere, a heavy plum
outline on every part, exactly ONE flat shadow shape at 55%, and nails in bright
festival colours. So the shading pass gets posterised to a single step and the
outline comes from the mask and the part ids. Nothing about the bake changes.
"""
import numpy as np
from PIL import Image, ImageDraw
import bake, sample

PLUM   = "#40163C"
CREAM  = "#FFF3DC"
SAND   = "#FFE9C4"
TEAL   = "#16A0BD"
GREEN  = "#0E8A6E"
MAGENTA= "#D81E5B"
MARIGOLD = "#F5A623"
SKIN   = "#E8A96F"
SHADOW = "#C4824C"
INK    = "#9C3418"
GHOST  = "#B5855E"
NAIL_BY_PID = {2: MAGENTA, 3: MARIGOLD, 4: CREAM, 5: GREEN, 6: MAGENTA}
# the stain still has to read on any skin, so it stays a ramp of flat inks
STAGE_INK = ["#2E2A20", "#D2691E", "#B2441C", "#9C3418"]


def hx(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def shifts(a):
    return (np.roll(a, 1, 0), np.roll(a, -1, 0), np.roll(a, 1, 1), np.roll(a, -1, 1))


def dilate(b, r):
    """Box dilation of a boolean field, via the integral image in bake.boxblur."""
    return bake.boxblur(b.astype(np.float32), int(r)) > 1e-6


def outlines(B, extra=None):
    """Silhouette plus every part boundary — Mela outlines each finger separately."""
    m, pid = B["mask"], B["pid"].astype(np.int16)
    edge = ~m
    for s in shifts(m):
        edge |= (m & ~s)
    inner = np.zeros_like(m)
    for s in shifts(pid):
        inner |= (m & (s > 0) & (pid != s))
    if extra is not None:
        for s in shifts(extra):
            inner |= (m & (extra != s))
    return (edge | inner) & m


def flat_shadow(B, cut=0.46, soft=30):
    """One region, one level.

    Lambert only -- no ambient occlusion. AO hugs the contour and every crevice,
    so thresholding it puts the "shadow" exactly where the outline already is,
    and nothing shows. Blurring wide first merges the per-finger shading into
    one broad shape, which is what Mela actually draws: a single flat form
    shadow down one side, not cel shading on each sausage.
    """
    L = np.array([-0.52, -0.46, 0.72]); L /= np.linalg.norm(L)
    m = B["mask"].astype(np.float32)
    lam = np.clip((B["n"] * L).sum(-1), 0, 1) * m
    r = int(soft * bake.SS)
    return (bake.boxblur(lam, r) / np.maximum(bake.boxblur(m, r), 1e-3)) < cut


def medallion(w, h, cx, cy, r):
    im = Image.new("RGB", (w, h), tuple((hx(SAND) * 255).astype(int)))
    d = ImageDraw.Draw(im)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=TEAL, outline=PLUM, width=max(2, r // 38))
    for i in range(12):
        a = i * np.pi / 6 - np.pi / 2
        px, py = cx + np.cos(a) * r, cy + np.sin(a) * r
        q = r * 0.107
        d.ellipse([px - q, py - q, px + q, py + q], fill=GREEN)
    rr = r * 0.787
    for i in range(0, 72, 2):                       # dashed cream ring
        a0, a1 = i * 5, i * 5 + 3.4
        d.arc([cx - rr, cy - rr, cx + rr, cy + rr], a0, a1, fill=CREAM, width=max(2, r // 50))
    return im


def paint(B, ao, henna_t, nail_t, stage=3, skin=SKIN, ink=None, ow=7, cut=0.46, soft=30):
    m = B["mask"]
    ha = sample.bilinear(henna_t[..., None], B["uv"], m)[..., 0]
    na = sample.bilinear(nail_t[..., None], B["uv"], m)[..., 0]
    nail = na > 0.5
    inked = ha > 0.45

    col = np.ones(m.shape + (3,), np.float32) * hx(skin)

    sh = flat_shadow(B, cut=cut, soft=soft) & m & ~nail
    col[sh] = (hx(skin) * 0.45 + hx(SHADOW) * 0.55)

    if stage is None:                               # not yet applied: a dotted ghost
        col[inked & ~nail] = hx(GHOST) * 0.35 + col[inked & ~nail] * 0.65
    else:
        col[inked & ~nail] = hx(STAGE_INK[stage] if ink is None else ink)

    for pid, c in NAIL_BY_PID.items():
        sel = nail & (B["pid"] == pid)
        col[sel] = hx(c)

    line = outlines(B, extra=nail)
    col[dilate(line, ow) & m] = hx(PLUM)
    return col, m


def place(col, m, bg, ow=7):
    """Composite onto the medallion, with the plum keyline carried outside the mask."""
    halo = dilate(m, ow) & ~m
    out = np.asarray(bg, np.float32) / 255.0
    out = np.where(halo[..., None], hx(PLUM), out)
    out = np.where(m[..., None], col, out)
    return out
