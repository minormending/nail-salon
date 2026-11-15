"""Render check images to art-private/original/: check-nails.png (all 15 nail
shapes over the nail hand) and check-henna.png (henna on the open hand, tones
t0 and t5). Needs rsvg-convert."""
import base64, io, os, subprocess, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import codexhand as CH, nails as NL, openhand as OH, skintones as ST

OUT = os.path.join(HERE, "..", "..", "art-private", "original")


def rsvg(svg, width):
    r = subprocess.run(["rsvg-convert", "-w", str(width), "-b", "white"], input=svg.encode(),
                       capture_output=True, check=True)
    return Image.open(io.BytesIO(r.stdout)).convert("RGB")


def nails_svg(shape, fill, href):
    o = ['<g stroke="%s" stroke-width="%.1f" stroke-linejoin="round" fill="%s">' % (CH.LINE, CH.LW, fill)]
    for k in CH.DIGITS:
        o.append('<path d="%s" transform="%s"/>' % (CH.nail_path(shape, k), CH.placement(k)))
    o.append("</g>")
    return ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="%s">'
            '<image xlink:href="%s" width="1024" height="1536"/>%s</svg>' % (CH.VIEWBOX, href, "".join(o)))


def check_nails(cols=5, w=300):
    href = "data:image/png;base64," + base64.b64encode(open(CH.RASTER, "rb").read()).decode()
    tiles = [rsvg(nails_svg(s, "#D81E5B", href), w) for s in NL.SHAPES]
    h = tiles[0].height
    sheet = Image.new("RGB", (cols * w, ((len(tiles) + cols - 1) // cols) * h), "white")
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * w, (i // cols) * h))
    sheet.save(os.path.join(OUT, "check-nails.png"))


def check_henna(w=700):
    ims = []
    for tid in ("t0", "t5"):
        _, _, skin, line = [t for t in ST.TONES if t[0] == tid][0]
        png64 = OH.hand_png(skin, line)
        svg = OH.svg([('fill="#9C3418"', OH.ALL)], png64)
        ims.append(rsvg(svg, w))
    sheet = Image.new("RGB", (w * 2, ims[0].height), "white")
    for i, t in enumerate(ims):
        sheet.paste(t, (i * w, 0))
    sheet.save(os.path.join(OUT, "check-henna.png"))


if __name__ == "__main__":
    which = sys.argv[1:] or ["nails", "henna"]
    if "nails" in which: check_nails()
    if "henna" in which: check_henna()
