import sys, numpy as np
sys.path.insert(0, '/private/tmp/claude-502/-Users-kevinramdath-projects-nail-salon/a87466b9-bcd6-43ad-a280-db87cb5245c9/scratchpad/bake')
import bake, atlas, render
from PIL import Image, ImageDraw, ImageFont

OUT = '/private/tmp/claude-502/-Users-kevinramdath-projects-nail-salon/a87466b9-bcd6-43ad-a280-db87cb5245c9/scratchpad/bake/out'
import os; os.makedirs(OUT, exist_ok=True)
BG = (0x1C, 0x2A, 0x27)

def font(sz, bold=False):
    for p in ('/System/Library/Fonts/Supplemental/Futura.ttc',
              '/System/Library/Fonts/Avenir Next.ttc',
              '/System/Library/Fonts/Helvetica.ttc'):
        try:
            return ImageFont.truetype(p, sz, index=1 if bold else 0)
        except Exception:
            pass
    return ImageFont.load_default()

F, FB = font(26), font(30, True)

def strip(panels, labels, title, w=440, pad=34, head=104):
    h = int(w * bake.H / bake.W)
    im = Image.new('RGB', (len(panels) * (w + pad) + pad, head + h + 76), BG)
    d = ImageDraw.Draw(im)
    d.text((pad, 34), title, font=FB, fill=(0xF2, 0xE6, 0xD6))
    for i, (p, lb) in enumerate(zip(panels, labels)):
        x = pad + i * (w + pad)
        im.paste(p.resize((w, h), Image.LANCZOS), (x, head))
        d.text((x, head + h + 20), lb, font=F, fill=(0xC9, 0xB5, 0x9C))
    return im

H, N = atlas.henna(), atlas.nails()
B = bake.bake(yaw=-20, pitch=10, roll=-4, curl=0.35)
ao = bake.ao_pass(B['z'], B['mask']); m = B['mask'].astype(np.float32)

def img(col): return render.to_image(col, mask=m)

# 1 — the pipeline
uvv = np.dstack([B['uv'][..., 0], B['uv'][..., 1], np.zeros_like(ao)])
p_uv = Image.fromarray((np.clip(uvv, 0, 1) * 255 * m[..., None]).astype(np.uint8))
flat = np.dstack([1 - H * .80 - N * .10, 1 - H * .92 - N * .52, 1 - H * .95 - N * .44])
p_at = Image.new('RGB', (bake.W, bake.H), (0xF6, 0xF2, 0xEA))   # letterbox: it is square
sq = Image.fromarray((np.clip(flat, 0, 1) * 255).astype(np.uint8)).resize((bake.W, bake.W), Image.LANCZOS)
p_at.paste(sq, (0, (bake.H - bake.W) // 2))

# the design landing on the geometry, with no lighting to distract from it
import sample
ha = sample.bilinear(H[..., None], B['uv'], m)[..., 0]
na = sample.bilinear(N[..., None], B['uv'], m)[..., 0]
raw = np.ones(B['uv'].shape[:2] + (3,), np.float32) * np.array([0.90, 0.80, 0.70])
raw = raw * (1 - ha[..., None] * 0.92) + np.array([0.45, 0.17, 0.09]) * ha[..., None] * 0.92
raw = raw * (1 - na[..., None]) + np.array([0.86, 0.33, 0.47]) * na[..., None]
p_pl = render.to_image(raw * m[..., None], mask=m)
p_fi = img(render.compose(B, ao, H, N, render.TONES[2], 3))
strip([p_uv, p_at, p_pl, p_fi],
      ['1 — the UV pass, baked once', '2 — what the user paints, flat',
       '3 — sampled through the pass', '4 — shaded, dyed, polished'],
      'One bake. Everything after it is arithmetic.').save(OUT + '/01-pipeline.png')

# 2 — skin tone
strip([img(render.compose(B, ao, H, N, t, 3)) for t in render.TONES],
      ['', '', '', '', '', ''], 'Six skin tones. One asset.',
      w=300).save(OUT + '/02-tones.png')

# 3 — the stain, over about two days
strip([img(render.compose(B, ao, H, N, render.TONES[3], k)) for k in range(4)],
      ['paste on, hour 0', 'flaked off, hour 6', 'deepening, hour 24', 'richest, hour 48'],
      'The 48-hour stain. Four numbers, not four drawings.').save(OUT + '/03-stain.png')

# 4 — poses and the other hand, same texture throughout
poses = [(-20, 10, -4, 0.35, False), (14, -6, 6, 0.10, False),
         (-32, 20, -10, 0.62, False), (20, 10, 4, 0.35, True)]
pp = []
for yaw, pit, rol, cu, mir in poses:
    b = bake.bake(yaw=yaw, pitch=pit, roll=rol, curl=cu, mirror=mir)
    a = bake.ao_pass(b['z'], b['mask'])
    pp.append(render.to_image(render.compose(b, a, H, N, render.TONES[3], 3),
                              mask=b['mask'].astype(np.float32)))
strip(pp, ['the pose we ship', 'turned, relaxed', 'turned, curled', 'the other hand'],
      'Four poses, two hands — and not one new drawing.').save(OUT + '/04-poses.png')

# 5 — hero
hero = img(render.compose(B, ao, H, N, render.TONES[3], 3, nail_rgb='#B8405F'))
c = Image.new('RGB', (bake.W + 120, bake.H + 120), (0x3F, 0x6E, 0x63))
c.paste(hero, (60, 60)); c.save(OUT + '/05-hero.png')
print('wrote', os.listdir(OUT))
