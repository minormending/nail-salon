import subprocess, pathlib, numpy as np
import build as B
from PIL import Image, ImageDraw, ImageFont

OUT = pathlib.Path('/private/tmp/claude-502/-Users-kevinramdath-projects-nail-salon/a87466b9-bcd6-43ad-a280-db87cb5245c9/scratchpad/paisley/project/img')
STAGES = ["#3B3326", "#D2691E", "#B2441C", "#9C3418"]
TONES = [("#F3CFA8", "#D4A878"), ("#E8A96F", "#C4824C"), ("#BC7F4C", "#9A6134"), ("#8A552F", "#6B3E20")]


def png(path, w=318, **kw):
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 470">'
           '<rect width="320" height="470" fill="#FFE9C4"/>' + B.inner(**kw) + '</svg>')
    pathlib.Path('/tmp/_f.svg').write_text(svg)
    subprocess.run(['/opt/homebrew/bin/rsvg-convert', '-w', str(w * 2), '/tmp/_f.svg', '-o', path], check=True)
    return Image.open(path).convert('RGB')


def font(sz):
    for f in ('/System/Library/Fonts/Supplemental/Futura.ttc', '/System/Library/Fonts/Helvetica.ttc'):
        try: return ImageFont.truetype(f, sz, index=1)
        except Exception: pass
    return ImageFont.load_default()


def strip(frames, labels, title, out, w=318):
    h = int(w * frames[0].height / frames[0].width); pad = 22; head = 80
    im = Image.new('RGB', (len(frames) * (w + pad) + pad, head + h + 60), (0x40, 0x16, 0x3C))
    d = ImageDraw.Draw(im)
    d.text((pad, 28), title, font=font(27), fill=(0xFF, 0xF3, 0xDC))
    for i, (f, lb) in enumerate(zip(frames, labels)):
        x = pad + i * (w + pad)
        im.paste(f.resize((w, h), Image.LANCZOS), (x, head))
        d.text((x, head + h + 16), lb, font=font(20), fill=(0xF5, 0xA6, 0x23))
    im.save(out); print(out.name, im.size)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    stain = [png('/tmp/s%d.png' % k, attrs='fill="%s" stroke="none"' % c) for k, c in enumerate(STAGES)]
    strip(stain, ['paste on, hour 0', 'flaked off, hour 6', 'deepening, hour 24', 'richest, hour 48'],
          'The 48-hour stain, flat.', OUT / 'flat-stain.png')
    tones = [png('/tmp/t%d.png' % k, skin=a, shadow=b) for k, (a, b) in enumerate(TONES)]
    strip(tones, ['', '', '', ''], 'Flat does not mean one skin.', OUT / 'flat-tones.png')
