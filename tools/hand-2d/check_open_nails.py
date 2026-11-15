"""Overlay check for the open hand's nails: every shape in magenta over the
drawn hand, plus a tile with stickers, to art-private/original/check-open-nails.png.
Needs rsvg-convert.

    python3 check_open_nails.py                       # the contact sheet
    python3 check_open_nails.py out.png shape x y w h # one zoomed tile
"""
import base64, io, json, os, subprocess, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import openhand as OH
import nails as NL

D = json.load(open(os.path.join(ROOT, "app", "src", "art", "openNails.json")))
N = json.load(open(os.path.join(ROOT, "app", "src", "art", "nails.json")))
HREF = 'data:image/png;base64,' + base64.b64encode(open(OH.SRC, 'rb').read()).decode()
SPOTS = [(175, 150), (153, 205), (197, 238), (175, 268)]      # the nail chair's sticker spots
CLOSE = (175, 290)


def tile(shape, stickers=False):
    lw = D["line"]["width"]
    o = []
    for k, p in D["digits"].items():
        g = '<g transform="translate(%s %s) rotate(%s)">' % (p["x"], p["y"], p["rotate"])
        g += '<path d="%s" fill="none" stroke="#FF00CC" stroke-width="%s" stroke-linejoin="round"/>' % (D["shapes"][shape][k], lw)
        if stickers:
            r = p["w"] / N["digits"][k]["w"]                   # open nail / chair nail
            for sx, sy in SPOTS:
                # the app maps a spot by half-width across and nail length along; here both by r
                x, y = (sx - CLOSE[0]) / 1.25 * r, (sy - CLOSE[1]) / 1.25 * r
                g += ('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#00A5A5" stroke="#2B1A26" stroke-width="2"/>'
                      % (x, y, 15 * 1.69 / 1.25 * r))
        g += "</g>"
        o.append(g)
    return "".join(o)


def render(shape, box, scale, stickers=False):
    x, y, w, h = box
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
           'width="%d" height="%d" viewBox="%d %d %d %d"><rect x="-200" y="-300" width="1500" height="2000" fill="#fff"/>'
           '<image xlink:href="%s" width="1024" height="1536"/>%s</svg>'
           % (w * scale, h * scale, x, y, w, h, HREF, tile(shape, stickers)))
    r = subprocess.run(["rsvg-convert"], input=svg.encode(), capture_output=True, check=True)
    return Image.open(io.BytesIO(r.stdout)).convert("RGB")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        render(sys.argv[2], [int(v) for v in sys.argv[3:7]], 4).save(sys.argv[1])
        sys.exit()
    box, sc, cols = (130, -120, 840, 880), 0.5, 4
    tw, th = int(box[2] * sc), int(box[3] * sc)
    sheet = Image.new("RGB", (cols * tw, 4 * th), "#fff")
    shapes = NL.SHAPES + ["natural"]            # the 16th tile: natural with stickers
    for i, s in enumerate(shapes):
        sheet.paste(render(s, box, sc, stickers=(i == 15)), ((i % cols) * tw, (i // cols) * th))
    out = os.path.join(ROOT, "art-private", "original", "check-open-nails.png")
    sheet.save(out)
    print(out, sheet.size)
