"""Fifteen nail shapes as parametric outlines.

Local frame: x across the nail, y along it. The cuticle sits at y = 0 and the
free edge points toward NEGATIVE y, so a shape is placed on a finger with
translate(...) rotate(...) the same way the henna leaves are. Every shape is
w wide at the cuticle; length is per shape, in units of w.
"""

SHAPES = ["natural", "round", "round long", "oval", "square",
          "almond", "pointed", "stiletto", "arrow head", "edge",
          "rock peak", "ballerina", "lipstick", "flare", "trapeze"]

# how far past the fingertip each shape runs, for the app's tap targets and
# for deciding whether a shape needs the finger drawn longer to carry it
LENGTH = {"natural": 1.05, "round": 1.2, "round long": 1.55, "oval": 1.55, "square": 1.25,
          "almond": 1.7, "pointed": 1.75, "stiletto": 2.2, "arrow head": 1.65, "edge": 1.75,
          "rock peak": 1.6, "ballerina": 1.85, "lipstick": 1.5, "flare": 1.55, "trapeze": 1.4}

ALIASES = {"coffin": "ballerina"}     # the web app's name for it


def _f(*v):
    return " ".join("%.2f" % x for x in v)


def path(shape, w):
    shape = ALIASES.get(shape, shape)
    h = w / 2.0
    L = LENGTH[shape] * w
    cut = "C %s %s %s Z" % (_f(h, 0.55 * h), _f(-h, 0.55 * h), _f(-h, 0))   # cuticle U
    start = "M %s" % _f(-h, 0)

    def cap(y0, peak, xl=-h, xr=h):
        yt = (peak - 0.25 * y0) / 0.75          # a cubic whose midpoint hits `peak`
        return "C %s %s %s" % (_f(xl, yt), _f(xr, yt), _f(xr, y0))

    if shape == "natural":
        y0 = -(L - 0.55 * h)
        body = "L %s %s L %s" % (_f(-h, y0), cap(y0, -L), _f(h, 0))
    elif shape in ("round", "round long"):
        y0 = -(L - h)
        body = "L %s A %s 0 0 1 %s L %s" % (_f(-h, y0), _f(h, h), _f(h, y0), _f(h, 0))
    elif shape == "oval":
        y0 = -(L - 0.85 * h)
        body = "L %s A %s 0 0 1 %s L %s" % (_f(-0.92 * h, y0), _f(0.92 * h, 0.85 * h),
                                          _f(0.92 * h, y0), _f(h, 0))
    elif shape == "square":
        r = 0.14 * h
        body = "L %s Q %s %s L %s Q %s %s L %s" % (
            _f(-h, -L + r), _f(-h, -L), _f(-h + r, -L), _f(h - r, -L),
            _f(h, -L), _f(h, -L + r), _f(h, 0))
    elif shape in ("almond", "pointed", "stiletto"):
        y1, ys, tipc = {"almond": (-0.45 * L, -0.80 * L, 0.30 * h),
                        "pointed": (-0.40 * L, -0.76 * L, 0.10 * h),
                        "stiletto": (-0.25 * L, -0.55 * L, 0.0)}[shape]
        sx = {"stiletto": -0.12 * h}.get(shape, -h)
        body = ("L %s C %s %s %s C %s %s %s L %s" % (
            _f(-h, y1), _f(-h, ys), _f(-tipc if tipc else sx, -L if tipc else -0.9 * L), _f(0, -L),
            _f(tipc if tipc else -sx, -L if tipc else -0.9 * L), _f(h, ys), _f(h, y1), _f(h, 0)))
    elif shape == "arrow head":
        y1 = -(L - 1.05 * h)
        body = "L %s L %s L %s L %s" % (_f(-h, y1), _f(0, -L), _f(h, y1), _f(h, 0))
    elif shape == "edge":
        # a pointed tip AND a raised ridge down the middle -- the ridge is what
        # makes it an edge nail rather than an arrow head
        y1 = -(L - 0.62 * h)
        body = "L %s L %s L %s L %s %s M %s L %s" % (
            _f(-0.80 * h, y1), _f(0, -L), _f(0.80 * h, y1), _f(h, 0), cut,
            _f(0, -L), _f(0, -0.42 * L))
        return start + " " + body
    elif shape == "rock peak":
        # a squat gable: same parallel sides as the arrow head, but the apex is
        # half the height, so the roof is ~120 degrees instead of ~90
        y1 = -(L - 0.58 * h)
        body = "L %s L %s L %s L %s" % (_f(-h, y1), _f(0, -L), _f(h, y1), _f(h, 0))
    elif shape == "ballerina":
        r, t = 0.12 * h, 0.55 * h
        body = "L %s Q %s %s L %s Q %s %s L %s" % (
            _f(-t, -L + r), _f(-t, -L), _f(-t + r, -L), _f(t - r, -L),
            _f(t, -L), _f(t, -L + r), _f(h, 0))
    elif shape == "lipstick":
        r = 0.16 * h
        body = "L %s Q %s %s L %s L %s" % (
            _f(-h, -L + r), _f(-h, -L), _f(-h + 1.6 * r, -L + 0.4 * r),
            _f(h, -(L - 0.9 * h)), _f(h, 0))
    elif shape == "flare":
        t = 1.32 * h
        body = "Q %s %s L %s Q %s %s" % (_f(-h, -0.70 * L), _f(-t, -L), _f(t, -L),
                                         _f(h, -0.70 * L), _f(h, 0))
    elif shape == "trapeze":
        t, r = 1.18 * h, 0.10 * h
        body = "L %s Q %s %s L %s Q %s %s L %s" % (
            _f(-t, -L + r), _f(-t, -L), _f(-t + r, -L), _f(t - r, -L),
            _f(t, -L), _f(t, -L + r), _f(h, 0))
    else:
        raise KeyError(shape)
    return " ".join([start, body, cut])
