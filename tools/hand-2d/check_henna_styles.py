"""Contact sheets and a containment check for the henna styles (hennastyles.py).

    python3 check_henna_styles.py            # writes art-private/original/henna-styles-*.png, prints clearances

Sheets (henna #9C3418 on the bare open hand):
    henna-styles-t0.png / -t3.png     every design of every position: the gol row, the digits per style, the cuff row
    henna-styles-sets-t0.png / -t3.png five whole hands, style k everywhere (phone-ish size)
    henna-styles-mixed.png            a mixed hand: a different style on each finger, lotus gol, scallops cuff
The check renders each design at full size and measures how far its nearest pixel is from the outline.
"""
import base64, io, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import export_app as EA, hennastyles as HS, openhand as OH, sheetbuild as SB, skintones as ST

OUT = os.path.join(EA.ROOT, "art-private", "original")
INK = "#9C3418"
_png = {}


def hand_png(tid):
    if tid not in _png:
        for t, label, skin, line in ST.TONES:
            if t == tid:
                _png[tid] = OH.hand_png(skin, line)
    return _png[tid]


def render(frags, crop, width, tid="t0", colour=INK):
    x, y, w, h = crop
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="%s %s %s %s">%s'
           '<image width="1024" height="1536" xlink:href="data:image/png;base64,%s"/><g fill="%s">%s</g></svg>'
           % (x, y, w, h, EA.plain(SB.DEFS), hand_png(tid), colour, "\n".join(EA.plain(f) for f in frags)))
    r = subprocess.run(["rsvg-convert", "-w", str(width)], input=svg.encode(), capture_output=True, check=True)
    return Image.open(io.BytesIO(r.stdout)).convert("RGB")


def font(n):
    for p in ("/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, n)
    return ImageFont.load_default()


def label(im, text):
    d = ImageDraw.Draw(im)
    d.text((8, 6), text, fill=(90, 90, 90), font=font(15))


def group_of(sec):
    return "gol" if sec == "gol" else "cuff" if sec == "cuff" else "finger"


DIG = ["pinky", "ring", "middle", "index", "thumb"]


def hand_with(choice, tid, crop=(0, 0, 1024, 1504), width=420):
    """choice: section -> style id (a section left out is bare)."""
    frags = [HS.design(s, st) for s, st in choice.items()]
    return render(frags, crop, width, tid)


def sheet_detail(tid):
    rows = []
    # gol: five cells around the medallion
    cx, cy, R = OH.MANDALA
    gcrop = (cx - 275, cy - 275, 550, 550)
    cells = []
    for i, n in HS.STYLES["gol"]:
        c = render([HS.design("gol", i)], gcrop, 400, tid)
        label(c, "gol: " + i)
        cells.append(c)
    rows.append(cells)
    # the five digits, one style per cell
    cells = []
    for i, n in HS.STYLES["finger"]:
        c = render([HS.design(d, i) for d in DIG], (130, 0, 830, 880), 400, tid)
        label(c, "fingers + thumb: " + i)
        cells.append(c)
    rows.append(cells)
    cells = []
    for i, n in HS.STYLES["cuff"]:
        c = render([HS.design("cuff", i)], (230, 1170, 400, 150), 400, tid)
        label(c, "cuff: " + i)
        cells.append(c)
    rows.append(cells)
    W = 5 * 400
    H = sum(max(c.height for c in r) for r in rows)
    sheet = Image.new("RGB", (W, H), "white")
    y = 0
    for r in rows:
        for k, c in enumerate(r):
            sheet.paste(c, (k * 400, y))
        y += max(c.height for c in r)
    return sheet


def sheet_sets(tid):
    cells = []
    for k in range(5):
        choice = {"gol": HS.STYLES["gol"][k][0], "cuff": HS.STYLES["cuff"][k][0]}
        for d in DIG:
            choice[d] = HS.STYLES["finger"][k][0]
        c = hand_with(choice, tid, width=440)
        label(c, "set %d: %s / %s / %s" % (k + 1, choice["gol"], choice["index"], choice["cuff"]))
        cells.append(c)
    sheet = Image.new("RGB", (5 * 440, cells[0].height), "white")
    for k, c in enumerate(cells):
        sheet.paste(c, (k * 440, 0))
    return sheet


MIXED = {"gol": "lotus", "thumb": "tips", "index": "chevrons", "middle": "drops", "ring": "rings", "pinky": "vines", "cuff": "scallops"}


def sheet_mixed():
    a = hand_with(MIXED, "t0", width=700)
    b = hand_with(MIXED, "t3", width=700)
    s = Image.new("RGB", (1400, a.height), "white")
    s.paste(a, (0, 0)); s.paste(b, (700, 0))
    return s


def clearances():
    """Nearest distance from each design's pixels to the outline (inner = skin that is not line)."""
    inner = HS.inner_mask()
    from_ = np.pad(inner, 1)
    edge = inner & ~(from_[:-2, 1:-1] & from_[2:, 1:-1] & from_[1:-1, :-2] & from_[1:-1, 2:])
    ey, ex = np.nonzero(edge)
    bp = np.stack([ex, ey], 1)[::2].astype(np.float32)
    out = {}
    for sec in HS.SECTIONS:
        for i, n in HS.STYLES[group_of(sec)]:
            svg = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="1536" viewBox="0 0 1024 1536">'
                   '%s<g fill="#000">%s</g></svg>' % (EA.plain(SB.DEFS), EA.plain(HS.design(sec, i))))
            r = subprocess.run(["rsvg-convert"], input=svg.encode(), capture_output=True, check=True)
            a = np.array(Image.open(io.BytesIO(r.stdout)).convert("RGBA"))[:, :, 3] > 100
            ys, xs = np.nonzero(a)
            sel = np.arange(0, len(xs), 3)
            P = np.stack([xs[sel], ys[sel]], 1).astype(np.float32)
            worst = 1e9
            for j in range(0, len(P), 4000):
                d = ((P[j:j + 4000, None, :] - bp[None, :, :]) ** 2).sum(2).min(1)
                worst = min(worst, float(d.min()))
            outside = int((a & ~inner).sum())
            out[(sec, i)] = (worst ** 0.5, outside)
    return out


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for tid in ("t0", "t3"):
        sheet_detail(tid).save(os.path.join(OUT, "henna-styles-%s.png" % tid))
        sheet_sets(tid).save(os.path.join(OUT, "henna-styles-sets-%s.png" % tid))
    sheet_mixed().save(os.path.join(OUT, "henna-styles-mixed.png"))
    if "--no-check" not in sys.argv:
        for (sec, i), (d, outside) in clearances().items():
            print("%-7s %-9s nearest outline %5.1f px   pixels outside %d" % (sec, i, d, outside))
