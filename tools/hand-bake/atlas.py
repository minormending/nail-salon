"""Draw the henna and the nails FLAT, in texture space. No hand here at all.

Everything the user makes lives in this file's output: one greyscale coverage
map. The stain colour, the skin under it and the stage of the stain are all
applied later, which is why none of them costs any artwork.
"""
import numpy as np
from PIL import Image, ImageDraw
import model

T = 1024
S = 2                                    # draw big, shrink down


def _rect(name):
    u0, u1, v0, v1 = model.ATLAS[name]
    return u0 * T * S, u1 * T * S, v0 * T * S, v1 * T * S


def _petal(d, cx, cy, ang, length, width, fill):
    pts = []
    for t in np.linspace(0, 1, 26):
        w = width * np.sin(np.pi * t) ** 0.85
        pts.append((t * length, w))
    pts += [(t * length, -w) for t, w in
            [(p[0] / length, p[1]) for p in reversed(pts)]]
    ca, sa = np.cos(ang), np.sin(ang)
    d.polygon([(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts], fill=fill)


def _vine(d, cx, y0, y1, amp, fill, leaf=11, n=7):
    """A bel: one serpentine stem with leaves alternating off it."""
    ys = np.linspace(y0, y1, 160)
    xs = cx + amp * np.sin((ys - y0) / (y1 - y0) * np.pi * 1.4)
    d.line(list(zip(xs, ys)), fill=fill, width=int(5 * S), joint="curve")
    for i in range(n):
        t = 0.10 + 0.78 * i / max(n - 1, 1)
        k = int(t * 159)
        side = -1 if i % 2 else 1
        _petal(d, xs[k], ys[k], np.pi / 2 * (1 if side > 0 else -1) + 0.5 * side,
               leaf * 2.0, leaf * 0.72, fill)
    d.ellipse([xs[-1] - 5 * S, ys[-1] - 5 * S, xs[-1] + 5 * S, ys[-1] + 5 * S], fill=fill)


def henna():
    im = Image.new("L", (T * S, T * S), 0)
    d = ImageDraw.Draw(im)
    ink = 255

    # ---- back of the hand: gol tikki, jaali, wrist band ---------------------
    X0, X1, Y0, Y1 = _rect("palm")
    w, h = X1 - X0, Y1 - Y0
    cx, cy = X0 + 0.50 * w, Y0 + 0.40 * h
    R = 0.235 * w

    d.ellipse([cx - R * 0.17, cy - R * 0.17, cx + R * 0.17, cy + R * 0.17], fill=ink)
    d.ellipse([cx - R * 0.33, cy - R * 0.33, cx + R * 0.33, cy + R * 0.33],
              outline=ink, width=int(3.5 * S))
    for i in range(8):
        _petal(d, cx, cy, i * np.pi / 4, R * 0.70, R * 0.17, ink)
    d.ellipse([cx - R * 0.80, cy - R * 0.80, cx + R * 0.80, cy + R * 0.80],
              outline=ink, width=int(3 * S))
    for i in range(16):
        a = i * np.pi / 8 + np.pi / 16
        _petal(d, cx + np.cos(a) * R * 0.80, cy + np.sin(a) * R * 0.80, a, R * 0.26, R * 0.075, ink)
    for i in range(24):
        a = i * np.pi / 12
        px, py = cx + np.cos(a) * R * 1.15, cy + np.sin(a) * R * 1.15
        d.ellipse([px - 3.4 * S, py - 3.4 * S, px + 3.4 * S, py + 3.4 * S], fill=ink)

    # jaali: a diagonal net, drawn on its own layer so it stays inside the patch
    net = Image.new("L", im.size, 0)
    nd = ImageDraw.Draw(net)
    for k in range(-26, 27):
        for sgn in (1, -1):
            x = cx + k * 0.052 * w
            nd.line([(x, Y0 + 0.02 * h), (x + sgn * 0.30 * w, Y0 + 0.235 * h)],
                    fill=105, width=int(2 * S))
    clip = Image.new("L", im.size, 0)
    ImageDraw.Draw(clip).rectangle([X0, Y0 + 0.02 * h, X1, Y0 + 0.235 * h], fill=255)
    im.paste(net, (0, 0), clip)
    d.arc([cx - R * 1.55, cy - R * 1.95, cx + R * 1.55, cy - R * 0.25],
          200, 340, fill=ink, width=int(4 * S))

    # wrist band
    for off, wd in ((0.855, 4.5), (0.935, 4.5)):
        d.line([(X0 + 0.04 * w, Y0 + off * h), (X1 - 0.04 * w, Y0 + off * h)],
               fill=ink, width=int(wd * S))
    for i in range(11):
        x = X0 + (0.075 + 0.085 * i) * w
        d.polygon([(x, Y0 + 0.862 * h), (x + 0.040 * w, Y0 + 0.898 * h),
                   (x, Y0 + 0.930 * h)], fill=ink)

    # ---- fingers: a cuff, a vine, a tip dot --------------------------------
    for name in ("index", "middle", "ring", "pinky", "thumb"):
        X0, X1, Y0, Y1 = _rect(name)
        w, h = X1 - X0, Y1 - Y0
        cx = X0 + 0.5 * w
        d.line([(X0, Y0 + 0.300 * h), (X1, Y0 + 0.300 * h)], fill=ink, width=int(4 * S))
        d.line([(X0, Y0 + 0.345 * h), (X1, Y0 + 0.345 * h)], fill=ink, width=int(4 * S))
        for i in range(5):
            px = X0 + (0.12 + 0.19 * i) * w
            d.ellipse([px - 3 * S, Y0 + 0.322 * h - 3 * S, px + 3 * S, Y0 + 0.322 * h + 3 * S],
                      fill=0)
        _vine(d, cx, Y0 + 0.385 * h, Y0 + 0.745 * h, 0.115 * w, ink, leaf=0.075 * w, n=9)
        for i in range(4):                       # a jaali chevron below the nail
            yy = Y0 + (0.690 + 0.018 * i) * h
            d.line([(cx - 0.20 * w, yy), (cx, yy + 0.016 * h), (cx + 0.20 * w, yy)],
                   fill=ink, width=int(2.6 * S))

    return np.asarray(im.resize((T, T), Image.LANCZOS), np.float32) / 255.0


def nails():
    im = Image.new("L", (T * S, T * S), 0)
    d = ImageDraw.Draw(im)
    for name in ("index", "middle", "ring", "pinky", "thumb"):
        X0, X1, Y0, Y1 = _rect(name)
        w, h = X1 - X0, Y1 - Y0
        cx = X0 + 0.5 * w
        d.ellipse([cx - 0.28 * w, Y0 + 0.762 * h, cx + 0.28 * w, Y0 + 0.944 * h], fill=255)
    return np.asarray(im.resize((T, T), Image.LANCZOS), np.float32) / 255.0
