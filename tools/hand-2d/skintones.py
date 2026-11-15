"""Both hands in every skin tone.

The nail hand is a raster (Codex's redraw): its skin is everything the
outline encloses, found by flood-filling the background in from the corners.
The tone goes under the line art, so lines stay crisp. The henna hand is
vector: its fill is the tone. A henna stain is a dye, so it MULTIPLIES with
the skin -- on deep tones it is darker and lower-contrast, as in life.
"""
import os, sys, subprocess
import numpy as np
from PIL import Image, ImageDraw

TONES = [  # id, label, skin, line
    ("t0", "Colouring book", "#FFFFFF", "#2B1A26"),
    ("t1", "Lightest", "#F9E4D4", "#2B1A26"),
    ("t2", "Light", "#EFC8A8", "#2B1A26"),
    ("t3", "Medium light", "#D9A47C", "#2B1A26"),
    ("t4", "Medium", "#B47A54", "#24121C"),
    ("t5", "Medium deep", "#83533A", "#1A0C12"),
    ("t6", "Deepest", "#553324", "#120709"),
    ("t7", "Green", "#8CC181", "#2B1A26"),
]


def rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)


def hexs(c):
    return "#%02X%02X%02X" % tuple(int(round(v)) for v in c)


FANTASY = ("t7",)   # green: not a real skin, so the henna keeps its true colours


def stain_on(skin, stain, tid=None):
    """A dye on skin: multiply -- except on a fantasy tone (green), where multiplying
    would turn every stain near-black and olive, so the stain stays its true colour."""
    if tid in FANTASY:
        return stain.upper()
    return hexs(rgb(skin) * rgb(stain) / 255.0)


def needs_edge(tid):
    """Deeper tones, where a multiplied stain sinks into the skin (and green,
    where it would turn muddy)."""
    return tid in ("t4", "t5", "t6", "t7")


def stain_attrs(tid, skin, ink):
    """The stain's SVG paint. On deeper tones it gets a thin edge 30% lighter
    than the skin, drawn behind the fill: the colour stays true, the design
    stays readable -- the way fresh henna catches light."""
    if not needs_edge(tid):
        return 'fill="%s" stroke="none"' % ink
    edge = hexs(rgb(skin) + (255 - rgb(skin)) * 0.30)
    return 'fill="%s" stroke="%s" stroke-width="1.6" paint-order="stroke" stroke-linejoin="round"' % (ink, edge)


def skin_mask(src):
    """True where the nail hand's skin is."""
    g = np.array(Image.open(src).convert("L"))
    ink = g < 200
    b = Image.fromarray(np.where(ink, 0, 255).astype(np.uint8)).convert("RGB")
    h, w = g.shape
    for seed in [(0, 0), (w - 1, 0), (0, h // 2), (w - 1, h // 2), (w - 1, h - 1), (0, h - 1)]:
        if b.getpixel(seed) == (255, 255, 255):
            ImageDraw.floodfill(b, seed, (255, 0, 0))
    a = np.array(b)
    outside = (a[:, :, 0] == 255) & (a[:, :, 1] == 0)
    return ~outside


def tint_nail_hand(src, skin, line, out):
    im = np.array(Image.open(src).convert("RGB")).astype(float)
    k = np.clip((245 - im.mean(2)) / (245 - 60), 0, 1)[..., None]   # ink amount
    m = skin_mask(src)[..., None]
    base = np.where(m, rgb(skin), 255.0)
    res = base * (1 - k) + rgb(line) * k
    Image.fromarray(res.astype(np.uint8)).quantize(colors=24, method=Image.Quantize.MEDIANCUT).save(out, optimize=True)


def tint_hand_rgba(src, skin, line, out):
    """As tint_nail_hand, but transparent outside the hand: the app lays the
    hand straight onto the cream screen, so the paper must not show."""
    im = np.array(Image.open(src).convert("RGB")).astype(float)
    k = np.clip((245 - im.mean(2)) / (245 - 60), 0, 1)[..., None]   # ink amount
    m = skin_mask(src)[..., None]
    rgb_ = np.where(m, rgb(skin) * (1 - k) + rgb(line) * k, rgb(line))
    a = np.where(m, 1.0, k)[..., 0] * 255
    res = np.dstack([rgb_, a]).astype(np.uint8)
    Image.fromarray(res, "RGBA").quantize(colors=32, method=Image.Quantize.FASTOCTREE).save(out, optimize=True)


if __name__ == "__main__":
    src, outdir = sys.argv[1], sys.argv[2]
    for tid, label, skin, line in TONES:
        tint_nail_hand(src, skin, line, os.path.join(outdir, "nail-hand-%s.png" % tid))
    print("ok")
