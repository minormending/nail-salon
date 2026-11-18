"""Export the app icon in every size and layer the app and stores need.

    python3 tools/app-icon/export.py

Reads the 1024px master store/play/src/icon.png (a henna hand on flat peacock
teal, made with Codex image generation) and writes

    app/assets/icon.png                       iOS / Expo icon, 1024, no alpha
    app/assets/android-icon-foreground.png    the hand cut out, inside the adaptive safe zone
    app/assets/android-icon-background.png    flat teal
    app/assets/android-icon-monochrome.png    hand silhouette with the henna knocked out
    app/assets/favicon.png                    48px
    store/play/out/icon.png                   512px Play listing icon

The hand is keyed off the teal by its red channel (teal has almost none, every
colour on the hand has plenty), then un-premultiplied so its edges carry no teal.

Needs numpy/Pillow.
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
TEAL = (2, 95, 112)  # #025F70, sampled from the master's background
# Adaptive icons are 108dp with a 66dp safe zone. These keep the nails inside it and
# give the hand the same share of the visible icon as on iOS.
FG_TOP, FG_HEIGHT = 0.22, 0.68


def path(*p):
    return os.path.join(ROOT, *p)


def cutout(rgb):
    a = rgb.astype(float)
    alpha = np.clip((a[:, :, 0] - TEAL[0] - 20) / 170, 0, 1)
    bg = np.array(TEAL, float)
    safe = np.maximum(alpha, 1e-3)[:, :, None]
    col = np.clip((a - (1 - alpha[:, :, None]) * bg) / safe, 0, 255)
    return np.dstack([col, alpha * 255]).astype(np.uint8)


def foreground(rgba):
    # Scale the hand into the safe zone and run the wrist off the bottom edge,
    # so it never ends in a cut line inside the launcher mask.
    ys = np.nonzero(rgba[:, :, 3].max(axis=1) > 0)[0]
    hand = Image.fromarray(rgba[ys[0]:]).convert("RGBA")
    h = int(1024 * FG_HEIGHT)
    w = round(hand.width * h / hand.height)
    hand = hand.resize((w, h), Image.LANCZOS)
    out = np.zeros((1024, 1024, 4), np.uint8)
    top, left = int(1024 * FG_TOP), (1024 - w) // 2
    rows = min(h, 1024 - top)
    out[top:top + rows, left:left + w] = np.asarray(hand)[:rows]
    out[top + rows:, left:left + w] = np.asarray(hand)[rows - 1]
    return out


def main():
    master = Image.open(path("store/play/src/icon.png")).convert("RGB")
    assert master.size == (1024, 1024), master.size
    master.save(path("app/assets/icon.png"))
    master.resize((512, 512), Image.LANCZOS).save(path("store/play/out/icon.png"))
    master.resize((48, 48), Image.LANCZOS).save(path("app/assets/favicon.png"))
    Image.new("RGB", (512, 512), TEAL).save(path("app/assets/android-icon-background.png"))

    rgb = np.asarray(master)
    fg = foreground(cutout(rgb))
    Image.fromarray(fg).save(path("app/assets/android-icon-foreground.png"))

    # Monochrome: the silhouette, with the cream henna and nail details cut away.
    c = fg[:, :, :3].astype(int)
    cream = np.clip((c[:, :, 2] - 90) / 100, 0, 1)
    mono = np.zeros_like(fg)
    mono[:, :, 3] = (fg[:, :, 3] * (1 - cream)).astype(np.uint8)
    Image.fromarray(mono).save(path("app/assets/android-icon-monochrome.png"))


if __name__ == "__main__":
    main()
