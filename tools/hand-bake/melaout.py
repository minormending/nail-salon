import sys, os
sys.path.insert(0, '/private/tmp/claude-502/-Users-kevinramdath-projects-nail-salon/a87466b9-bcd6-43ad-a280-db87cb5245c9/scratchpad/bake')
import numpy as np, bake, atlas, mela
from PIL import Image, ImageDraw, ImageFont

IMG = '/private/tmp/claude-502/-Users-kevinramdath-projects-nail-salon/a87466b9-bcd6-43ad-a280-db87cb5245c9/scratchpad/paisley/project/img/'
os.makedirs(IMG, exist_ok=True)
H, N = atlas.henna(), atlas.nails()
B = bake.bake(yaw=-14, pitch=8, roll=-3, curl=0.30)
ao = bake.ao_pass(B['z'], B['mask']); m = B['mask']
ys, xs = np.where(m); hw = xs.max() - xs.min(); hh = ys.max() - ys.min()
MCX = (xs.min() + xs.max()) // 2; MR = int(0.664 * hw); MCY = (ys.min() + ys.max()) // 2 + int(0.138 * hh)
BG = mela.medallion(bake.WS, bake.HS, MCX, MCY, MR)
PAD = 18 * bake.SS
X0 = max(0, min(xs.min(), MCX - int(MR * 1.11)) - PAD); X1 = min(bake.WS, max(xs.max(), MCX + int(MR * 1.11)) + PAD)
Y0 = max(0, min(ys.min(), MCY - int(MR * 1.11)) - PAD); Y1 = min(bake.HS, max(ys.max(), MCY + int(MR * 1.11)) + PAD)
CW, CH = (X1 - X0) // bake.SS, (Y1 - Y0) // bake.SS


def frame(stage, skin=mela.SKIN, bg=BG):
    col, _ = mela.paint(B, ao, H, N, stage=stage, skin=skin, cut=0.56, soft=16)
    out = np.clip(mela.place(col, m, bg), 0, 1)[Y0:Y1, X0:X1]
    return Image.fromarray((out * 255).astype(np.uint8)).resize((CW, CH), Image.LANCZOS)


if __name__ == '__main__':
    for k in range(4):
        frame(k).save(IMG + 'mela-%d.png' % k)
    frame(None).save(IMG + 'mela-ghost.png')
    print('screen frames', CW, CH)

    def font(sz, bold=True):
        for p in ('/System/Library/Fonts/Supplemental/Futura.ttc', '/System/Library/Fonts/Helvetica.ttc'):
            try: return ImageFont.truetype(p, sz, index=1 if bold else 0)
            except Exception: pass
        return ImageFont.load_default()

    def strip(frames, labels, title, w, out):
        h = int(w * CH / CW); pad = 24; head = 86
        im = Image.new('RGB', (len(frames) * (w + pad) + pad, head + h + 64), (0x40, 0x16, 0x3C))
        d = ImageDraw.Draw(im)
        d.text((pad, 30), title, font=font(29), fill=(0xFF, 0xF3, 0xDC))
        for i, (f, lb) in enumerate(zip(frames, labels)):
            x = pad + i * (w + pad)
            im.paste(f.resize((w, h), Image.LANCZOS), (x, head))
            d.text((x, head + h + 18), lb, font=font(22), fill=(0xF5, 0xA6, 0x23))
        im.save(out); print(out.split('/')[-1], im.size)

    strip([frame(k) for k in range(4)],
          ['paste on, hour 0', 'flaked off, hour 6', 'deepening, hour 24', 'richest, hour 48'],
          'Still the same bake. Still the 48-hour stain.', 318, IMG + 'mela-stain.png')
    strip([frame(3, skin=s) for s in ('#F6D2AC', '#E8A96F', '#B97A47', '#7E4E2C')],
          ['', '', '', ''], 'Flat does not mean one skin.', 318, IMG + 'mela-tones.png')
