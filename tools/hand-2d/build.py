"""Assemble the flat Mela hand as SVG. Nothing is rendered; this is path data."""
import numpy as np
import twod as T

PLUM, CREAM, SAND = "#40163C", "#FFF3DC", "#FFE9C4"
TEAL, GREEN, MAGENTA, MARIGOLD = "#16A0BD", "#0E8A6E", "#D81E5B", "#F5A623"
SKIN, SHADOW, INK = "#E8A96F", "#C4824C", "#9C3418"
FINGERS = ("index", "middle", "ring", "pinky")
NAIL = {"index": MAGENTA, "middle": MARIGOLD, "ring": CREAM, "pinky": GREEN, "thumb": MAGENTA}
MC, MR = (158, 300), 150


def deg(d):
    return np.degrees(np.arctan2(d[0], -d[1]))


def medallion():
    o = ['<circle cx="%d" cy="%d" r="%d" fill="%s"/>' % (MC[0], MC[1], MR, TEAL),
         '<circle cx="%d" cy="%d" r="%d" fill="none" stroke="%s" stroke-width="4"/>' % (MC[0], MC[1], MR, PLUM),
         '<g fill="%s">' % GREEN]
    for i in range(12):
        a = i * np.pi / 6 - np.pi / 2
        o.append('<circle cx="%.0f" cy="%.0f" r="16"/>' % (MC[0] + np.cos(a) * MR, MC[1] + np.sin(a) * MR))
    o.append('</g>')
    o.append('<circle cx="%d" cy="%d" r="118" fill="none" stroke="%s" stroke-width="3" stroke-dasharray="9 9"/>'
             % (MC[0], MC[1], CREAM))
    return "\n".join(o)


def hand(skin=SKIN, shadow=SHADOW):
    o = ['<g fill="%s" stroke="%s" stroke-width="3.4" stroke-linejoin="round">' % (skin, PLUM),
         '<path d="%s"/>' % T.palm_outline(),
         '<path d="%s"/>' % T.digit_outline("thumb")]
    for f in FINGERS:
        o.append('<path d="%s"/>' % T.digit_outline(f))
    o.append('</g>')
    # exactly one flat shadow, at 55%, the way Mela does it
    o.append('<g fill="%s" opacity="0.55">' % shadow)
    o.append('<path d="%s"/>' % T.palm_sliver())
    o.append('<path d="%s"/>' % T.right_sliver("thumb", 0.12, 0.96, 0.40))
    o.append('<path d="%s"/>' % T.right_sliver("pinky", 0.10, 0.94, 0.38))
    o.append('</g>')
    return "\n".join(o)


def gol():
    o = ['<g transform="translate(155 344)">']
    for i in range(12):
        o.append('<use href="#pOut" transform="rotate(%d)"/>' % (i * 30))
    for i in range(8):
        o.append('<use href="#pIn" transform="rotate(%d)"/>' % (i * 45))
    for i in range(8):
        o.append('<use href="#dS" transform="rotate(%.1f)"/>' % (i * 45 + 22.5))
    for i in range(18):
        o.append('<use href="#dT" transform="rotate(%d)"/>' % (i * 20))
    o.append('<circle r="5.5"/>')
    for i in range(6):
        a = i * np.pi / 3
        o.append('<circle cx="%.1f" cy="%.1f" r="1.7"/>' % (np.cos(a) * 10, np.sin(a) * 10))
    o.append('</g>')
    return "\n".join(o)


def vine(name, t0, t1, n=5):
    C = T.centre(name)
    i0, i1 = int(t0 * (len(C) - 1)), int(t1 * (len(C) - 1))
    P = C[i0:i1 + 1, :2][::6]
    tg = np.gradient(P, axis=0)
    tg /= np.linalg.norm(tg, axis=1, keepdims=True) + 1e-9
    nm = np.stack([-tg[:, 1], tg[:, 0]], 1) * 1.35
    o = ['<path d="%s"/>' % T.smooth(list(P + nm) + list((P - nm)[::-1]))]
    for i in range(n):
        x, y, r, d = T.at(C, t0 + (t1 - t0) * (0.08 + 0.84 * i / (n - 1)))
        o.append('<g transform="translate(%.1f %.1f) rotate(%.1f)"><use href="#lf"/><use href="#rf"/></g>'
                 % (x, y, deg(d)))
    x, y, r, d = T.at(C, t1)
    o.append('<ellipse cx="%.1f" cy="%.1f" rx="3.4" ry="5" transform="rotate(%.1f %.1f %.1f)"/>'
             % (x, y, deg(d), x, y))
    return "\n".join(o)


def band(y0=418.0, y1=440.0):
    xl, xr = T.palm_edge(y0, -1) + 7, T.palm_edge(y0, 1) - 7
    o = ['<path d="M %.1f %.1f L %.1f %.1f" fill="none" stroke="currentColor" stroke-width="3"/>' % (xl, y0, xr, y0),
         '<path d="M %.1f %.1f L %.1f %.1f" fill="none" stroke="currentColor" stroke-width="3"/>' % (xl + 3, y1, xr - 3, y1)]
    n = 9
    for i in range(n):
        x = xl + 4 + (xr - xl - 8) * i / n
        w = (xr - xl - 8) / n * 0.62
        o.append('<path d="M %.1f %.1f L %.1f %.1f L %.1f %.1f Z"/>'
                 % (x, y0 + 3, x + w, (y0 + y1) / 2, x, y1 - 3))
    return "\n".join(o)


def henna(attrs=None):
    o = ['<g %s>' % (attrs or 'fill="%s" stroke="none"' % INK), gol()]
    for f in FINGERS:
        o.append(vine(f, 0.15, 0.76, n=5))
    o.append(vine("thumb", 0.22, 0.74, n=4))
    o.append('</g>')
    return "\n".join(o)


def nails():
    o = ['<g stroke="%s" stroke-width="3" stroke-linejoin="round">' % PLUM]
    for f in FINGERS + ("thumb",):
        C = T.centre(f)
        x, y, r, d = T.at(C, 1.0)
        x, y = x - d[0] * r * 0.18, y - d[1] * r * 0.18
        o.append('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="%s" transform="rotate(%.1f %.1f %.1f)"/>'
                 % (x, y, r * 0.68, r * 0.92, NAIL[f], deg(d), x, y))
    o.append('</g>')
    return "\n".join(o)


DEFS = '''<defs>
<path id="lf" d="M 0 0 C -5.2 -2.1, -10.4 -6.1, -13 -12.6 C -8.3 -11, -2.6 -6.1, 0 0 Z"/>
<path id="rf" d="M 0 0 C 5.2 -2.1, 10.4 -6.1, 13 -12.6 C 8.3 -11, 2.6 -6.1, 0 0 Z"/>
<path id="pOut" d="M 0 -34 C -7.8 -38, -7.8 -50, 0 -54 C 7.8 -50, 7.8 -38, 0 -34 Z"/>
<path id="pIn" d="M 0 -13 C -6 -16, -6 -23, 0 -26 C 6 -23, 6 -16, 0 -13 Z"/>
<circle id="dS" cy="-31" r="1.9"/>
<circle id="dT" cy="-60" r="1.8"/>
</defs>'''


def svg(attrs=None, bg=True, skin=SKIN, shadow=SHADOW):
    body = [DEFS]
    if bg:
        body.append(medallion())
    body += [hand(skin, shadow), henna(attrs), nails()]
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d">\n' % T.VB
            + "\n".join(body) + "\n</svg>")


if __name__ == "__main__":
    import sys
    open(sys.argv[1], "w").write(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 470" width="640" height="940">'
        '<rect width="320" height="470" fill="%s"/>' % SAND + svg()[svg().index(">") + 1:])


def inner(attrs=None, bg=True, skin=SKIN, shadow=SHADOW):
    """Just the contents, for inlining into a screen."""
    full = svg(attrs, bg, skin, shadow)
    return full[full.index(">") + 1:full.rindex("</svg>")]
