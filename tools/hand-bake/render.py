"""Shade the baked passes and dye them through the atlas.

Skin tone, stain stage and nail colour are all applied here, at composite time.
Each is a few numbers, not a new drawing.
"""
import numpy as np
from PIL import Image
import bake, sample

TONES = ["#F6D9BD", "#E3B38B", "#C58A5F", "#9C6340", "#6E4429", "#49301F"]
# Dark paste -> flaking orange -> deepening -> richest reddish-brown, ~48h apart.
# After the paste comes off these are MULTIPLIERS, not colours: a cured stain is
# dye sitting in the skin, so it darkens whatever tone is underneath instead of
# painting a fixed colour over it. That is also why one set of numbers works on
# every skin tone.
PASTE = "#2F2A1C"
STAGE_MUL = [None,
             np.array([0.96, 0.60, 0.42], np.float32),
             np.array([0.82, 0.41, 0.28], np.float32),
             np.array([0.63, 0.29, 0.20], np.float32)]
STAGE_OPACITY = [0.98, 0.82, 0.88, 0.94]

L = np.array([-0.40, -0.60, 0.69]); L /= np.linalg.norm(L)
L2 = np.array([0.55, 0.35, 0.50]); L2 /= np.linalg.norm(L2)


def hexf(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


def shade(B, ao):
    n, m = B["n"], B["mask"]
    key = np.clip((n * L).sum(-1), 0, 1)
    fill = np.clip((n * L2).sum(-1), 0, 1)
    wrap = np.clip(((n * L).sum(-1) + 0.45) / 1.45, 0, 1) ** 2.0     # subsurface creep
    rim = np.clip(1 - np.abs(n[..., 2]), 0, 1) ** 3.0
    lit = (0.30 + 0.62 * key + 0.20 * fill) * ao
    spec = np.clip((n * ((L + np.array([0, 0, 1.0])) /
                         np.linalg.norm(L + np.array([0, 0, 1.0])))).sum(-1), 0, 1) ** 26
    return lit, wrap, rim * m, spec * m


def compose(B, ao, henna_t, nail_t, tone, stage, nail_rgb="#C8476B", gloss=0.55):
    m = B["mask"]
    lit, wrap, rim, spec = shade(B, ao)
    base = hexf(tone)
    skin = base[None, None, :] * lit[..., None]
    skin += base[None, None, :] * np.array([0.16, 0.04, 0.02]) * wrap[..., None] * ao[..., None]
    skin += rim[..., None] * base[None, None, :] * 0.30

    ha = sample.bilinear(henna_t[..., None], B["uv"], m)[..., 0]
    na = sample.bilinear(nail_t[..., None], B["uv"], m)[..., 0]

    col = skin
    if stage is not None:
        a = np.clip(ha * STAGE_OPACITY[stage], 0, 1)[..., None]
        if stage == 0:                       # wet paste sits ON the skin
            col = col * (1 - a) + hexf(PASTE)[None, None, :] * (0.45 + 0.55 * lit[..., None]) * a
        else:                                # a cured stain is dye IN the skin
            col = col * (1.0 - a * (1.0 - STAGE_MUL[stage][None, None, :]))
    if nail_rgb is not None:
        nc = hexf(nail_rgb)[None, None, :] * (0.34 + 0.78 * lit[..., None])
        nc = nc + spec[..., None] * gloss
        col = col * (1 - na[..., None]) + nc * na[..., None]
    col = col + spec[..., None] * 0.10 * m[..., None]
    return np.clip(col, 0, 1) * m[..., None]


def to_image(col, bg="#2B4E46", w=bake.W, h=bake.H, mask=None):
    b = hexf(bg)[None, None, :]
    a = mask[..., None] if mask is not None else 1.0
    out = col * a + b * (1 - a)
    im = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))
    return im.resize((w, h), Image.LANCZOS)
