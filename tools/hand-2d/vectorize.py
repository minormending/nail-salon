"""Vector versions of the two hand drawings, so the line art stays crisp at any zoom.

    python3 vectorize.py [--check]

For each raster (nail_hand_v1.png, open_hand_v1.png):

  ink   the ink-coverage field k = clip((245 - gray) / (245 - 60), 0, 1) (the
        same amount skintones.tint_hand_rgba uses) is bicubic-upsampled UP x,
        and its k = ISO iso-contours are extracted with our own marching
        squares (sub-pixel interpolation along cell edges). Every closed
        contour is one edge of a stroke; with fill-rule evenodd they are the
        line shapes (outer + inner edges, holes, dashes, nail outlines).
  skin  the hand silhouette (skintones.skin_mask: everything not reachable
        from the corners), blurred, upsampled and contoured the same way, a
        little inset so it sits under the ink.

Contours are lightly Gaussian-smoothed (SMOOTH_PX), Douglas-Peucker simplified
(DP_TOL source px) and turned into cubic beziers through the kept points, with
the raw contour's tangent at each vertex; vertices are added until every curve
lies within FIT_TOL of the raw contour (so a corner is never cut). Contours on
the image border stay flat there. Output is app/src/art/handVectors.json
in the rasters' own pixel coordinates (0 0 1024 1536), 1 decimal.

--check writes art-private/original/vec-check-*.png (vector vs raster at 1x,
4x, and a difference overlay).
"""
import io, json, math, os, subprocess, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import skintones as ST

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ORIG = os.path.join(ROOT, "art-private", "original")
OUT = os.path.join(ROOT, "app", "src", "art", "handVectors.json")
HANDS = {"nailHand": os.path.join(ORIG, "nail_hand_v1.png"),
         "openHand": os.path.join(ORIG, "open_hand_v1.png")}
W, H = 1024, 1536

UP = 3             # field upsampling
ISO = 0.5          # ink iso level
SMOOTH_PX = 1.3    # contour smoothing sigma (source px, approx)
DP_TOL = 0.35      # source px
MIN_AREA = 4.0     # source px^2: smaller contours are specks
CORNER_DEG = 50    # turning angle (over TAN_WIN raw samples each side) above which a vertex stays sharp
TAN_WIN = 6        # raw samples (~0.33 px apart) either side for the tangent
FIT_TOL = 0.4      # source px: max gap between a smoothed segment and the raw contour
SKIN_INSET = 1     # px
SKIN_SIGMA = 1.0   # px: blur before contouring the skin mask
SKIN_DP_TOL = 0.5


# ---------------------------------------------------------------- field
def ink_field(src):
    im = np.array(Image.open(src).convert("RGB")).astype(np.float32)
    return np.clip((245 - im.mean(2)) / (245 - 60), 0, 1).astype(np.float32)


def upsample(f, up):
    """Smooth (bicubic) upsample of a float field; sample (i, j) of the result
    sits at source coordinate ((j + .5) / up, (i + .5) / up)."""
    im = Image.fromarray(f.astype(np.float32), "F")
    im = im.resize((f.shape[1] * up, f.shape[0] * up), Image.BICUBIC)
    return np.array(im, dtype=np.float32)


def blur(f, sigma):
    r = int(math.ceil(sigma * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    P = np.pad(f, r, mode="edge")
    P = sum(k[i] * P[:, i:i + f.shape[1]] for i in range(len(k)))
    P = sum(k[i] * P[i:i + f.shape[0]] for i in range(len(k)))
    return P.astype(np.float32)


# ---------------------------------------------------------------- marching squares
def marching_squares(F, t):
    """Closed iso-contours of F at level t as a list of (N, 2) float arrays of
    (x, y) in F's index coordinates. F must be < t on its whole border, so
    every contour closes."""
    b = F >= t
    h, w = F.shape
    TL, TR = b[:-1, :-1], b[:-1, 1:]
    BL, BR = b[1:, :-1], b[1:, 1:]
    case = (TL * 8 + TR * 4 + BR * 2 + BL * 1).astype(np.int8)
    ci, cj = np.nonzero((case != 0) & (case != 15))
    cs = case[ci, cj].astype(int)
    # saddles: connected through the centre or not
    cen = (F[ci, cj] + F[ci, cj + 1] + F[ci + 1, cj] + F[ci + 1, cj + 1]) * 0.25 >= t
    # edge ids: 2 * (i * w + j) + (0 horizontal edge (i,j)-(i,j+1) | 1 vertical edge (i,j)-(i+1,j))
    T = 2 * (ci * w + cj)
    B = 2 * ((ci + 1) * w + cj)
    L = 2 * (ci * w + cj) + 1
    R = 2 * (ci * w + cj + 1) + 1
    # segment endpoint pairs per case
    pairs = {1: (L, B), 2: (B, R), 3: (L, R), 4: (T, R), 6: (T, B), 7: (T, L), 8: (T, L),
             9: (T, B), 11: (T, R), 12: (L, R), 13: (B, R), 14: (L, B)}
    sa, sb = [], []
    for c, (e1, e2) in pairs.items():
        m = cs == c
        sa.append(e1[m]); sb.append(e2[m])
    for c in (5, 10):
        m = cs == c
        # case 5: TR and BL inside; 10: TL and BR inside. Connected: the two outside
        # corners are cut off separately; else the two inside corners are.
        sep_in = (~cen[m]) if c == 5 else cen[m]       # inside corners separate? (TR / BL for 5; TR / BL for 10)
        for sel, (p1, p2) in ((sep_in, ((T, R), (L, B))), (~sep_in, ((T, L), (B, R)))):
            for (e1, e2) in (p1, p2):
                sa.append(e1[m][sel]); sb.append(e2[m][sel])
    sa = np.concatenate(sa); sb = np.concatenate(sb)
    S = len(sa)
    if S == 0:
        return []
    ids = np.concatenate([sa, sb])
    uid, inv = np.unique(ids, return_inverse=True)
    # vertex coordinates
    kind = uid & 1
    cell = uid >> 1
    vi, vj = cell // w, cell % w
    x = np.empty(len(uid)); y = np.empty(len(uid))
    hz = kind == 0
    a = F[vi, vj].astype(np.float64)
    other = np.where(hz, F[vi, np.minimum(vj + 1, w - 1)], F[np.minimum(vi + 1, h - 1), vj]).astype(np.float64)
    tt = (t - a) / (other - a)
    x = np.where(hz, vj + tt, vj.astype(float))
    y = np.where(hz, vi.astype(float), vi + tt)
    # every vertex id has exactly two segment ends; pair them up
    order = np.argsort(inv, kind="stable")
    partner = np.empty(2 * S, np.int64)
    partner[order[0::2]] = order[1::2]
    partner[order[1::2]] = order[0::2]
    seen = np.zeros(S, bool)
    loops = []
    for s0 in range(S):
        if seen[s0]:
            continue
        e = s0 + S                      # arrive at end b of segment s0
        verts = [inv[s0]]
        s = s0
        while True:
            seen[s] = True
            verts.append(inv[e])
            q = partner[e]              # entry at the same vertex, in the next segment
            s = q % S
            if s == s0:
                break
            e = (q + S) % (2 * S)       # leave by the segment's other end
        v = np.array(verts[:-1])
        loops.append(np.stack([x[v], y[v]], 1))
    return loops


def area(P):
    x, y = P[:, 0], P[:, 1]
    return 0.5 * float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


# ---------------------------------------------------------------- simplify + smooth
def dp_open_idx(pts, lo, hi, eps, keep):
    """Douglas-Peucker on pts[lo..hi] (inclusive); marks kept indices in keep."""
    stack = [(lo, hi)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        p, q = pts[a], pts[b]
        v = q - p
        n = math.hypot(*v)
        dr = pts[a + 1:b] - p
        d = np.abs(v[0] * dr[:, 1] - v[1] * dr[:, 0]) / n if n else np.hypot(dr[:, 0], dr[:, 1])
        i = int(np.argmax(d))
        if d[i] > eps:
            keep[a + 1 + i] = True
            stack += [(a, a + 1 + i), (a + 1 + i, b)]


def dp_closed_idx(P, eps):
    """DP on a closed ring: split at the point farthest from P[0]. Indices kept."""
    d = np.hypot(*(P - P[0]).T)
    k = int(np.argmax(d))
    keep = np.zeros(len(P), bool)
    keep[0] = keep[k] = True
    dp_open_idx(P, 0, k, eps, keep)
    Q = np.vstack([P, P[:1]])
    keep2 = np.zeros(len(Q), bool)
    keep2[k] = keep2[-1] = True
    dp_open_idx(Q, k, len(Q) - 1, eps, keep2)
    keep |= keep2[:-1]
    return np.nonzero(keep)[0]


def fmt(v):
    s = "%.1f" % v
    if s in ("-0.0", "0.0"):
        return "0"
    if s.endswith(".0"):
        s = s[:-2]
    return s


def ring_tangents(R, idx, border, m=TAN_WIN):
    """Unit tangent of the raw contour at each kept vertex (central difference
    over +-m raw samples), zero where the contour turns sharply or sits on the
    image border."""
    N = len(R)
    idx = np.asarray(idx)
    fwd = R[(idx + m) % N] - R[idx]
    bwd = R[idx] - R[(idx - m) % N]
    uf = fwd / np.maximum(np.hypot(*fwd.T), 1e-9)[:, None]
    ub = bwd / np.maximum(np.hypot(*bwd.T), 1e-9)[:, None]
    ang = np.degrees(np.arccos(np.clip((uf * ub).sum(1), -1, 1)))
    t = uf + ub
    t = t / np.maximum(np.hypot(*t.T), 1e-9)[:, None]
    t[(ang > CORNER_DEG) | border[idx]] = 0
    return t


def handles(P, T):
    """Cubic control points for every segment i -> i+1 of the closed ring P
    with unit tangents T (zero = sharp vertex): handle = 1/3 chord."""
    nxt = np.roll(P, -1, 0)
    ln = np.hypot(*(nxt - P).T)
    c1 = P + T * (ln / 3)[:, None]
    c2 = nxt - np.roll(T, -1, 0) * (ln / 3)[:, None]
    return c1, c2


def seg_dist(pts, poly):
    """Max over pts of the distance to the polyline poly."""
    A, B = poly[:-1], poly[1:]
    v = B - A
    vv = np.maximum((v * v).sum(1), 1e-12)
    w = pts[:, None, :] - A[None]
    t = np.clip((w * v[None]).sum(2) / vv[None], 0, 1)
    d = np.hypot(*(pts[:, None, :] - (A[None] + v[None] * t[..., None])).transpose(2, 0, 1))
    return d.min(1).max()


def fit_curves(R, idx, border, tol):
    """Insert vertices (the raw point farthest from the curve) until every
    smoothed segment lies within tol of the raw contour between its ends."""
    idx = list(idx)
    ts = np.linspace(0, 1, 20)[:, None]
    for _ in range(8):
        P = R[idx]
        T = ring_tangents(R, idx, border)
        c1, c2 = handles(P, T)
        add = []
        n = len(idx)
        for i in range(n):
            a, b = idx[i], idx[(i + 1) % n]
            if b == a:
                continue
            raw = R[a + 1:b] if b > a else np.vstack([R[a + 1:], R[:b]])
            if len(raw) < 1:
                continue
            p0, p1, p2, p3 = P[i], c1[i], c2[i], P[(i + 1) % n]
            Q = ((1 - ts) ** 3) * p0 + 3 * ((1 - ts) ** 2) * ts * p1 + 3 * (1 - ts) * ts ** 2 * p2 + ts ** 3 * p3
            # one-sided: raw -> curve distance only
            dd = np.hypot(*(raw[:, None, :] - Q[None]).transpose(2, 0, 1))
            dmin = dd.min(1)
            j = int(np.argmax(dmin))
            if dmin[j] > tol:
                add.append((a + 1 + j) % len(R) if b > a else (a + 1 + j) % len(R))
        if not add:
            break
        idx = sorted(set(idx) | set(add))
    return idx


def smooth_path(P, T):
    """Closed ring of vertices (tangents T) -> path string (cubic beziers,
    relative commands, coordinates rounded to 0.1 first)."""
    P = np.round(P, 1)
    n = len(P)
    c1, c2 = handles(P, T)
    c1 = np.round(c1, 1); c2 = np.round(c2, 1)
    out = ["M%s %s" % (fmt(P[0, 0]), fmt(P[0, 1]))]
    cur = P[0]
    for i in range(n):
        j = (i + 1) % n
        p0, p3 = P[i], P[j]
        v = p3 - p0
        L = max(math.hypot(*v), 1e-9)
        dev = max(abs(v[0] * (c1[i][1] - p0[1]) - v[1] * (c1[i][0] - p0[0])),
                  abs(v[0] * (c2[i][1] - p0[1]) - v[1] * (c2[i][0] - p0[0]))) / L
        last = (j == 0)
        if dev < 0.06:
            out.append("z" if last else "l%s %s" % (fmt(v[0]), fmt(v[1])))
        else:
            nums = (c1[i][0] - cur[0], c1[i][1] - cur[1], c2[i][0] - cur[0], c2[i][1] - cur[1],
                    p3[0] - cur[0], p3[1] - cur[1])
            out.append("c" + " ".join(fmt(a) for a in nums) + ("z" if last else ""))
        cur = p3
    return "".join(out)


def contours_to_path(loops, tol, min_area, fit_tol=None):
    fit_tol = FIT_TOL if fit_tol is None else fit_tol
    parts, npts, ncont = [], 0, 0
    for L in loops:
        if abs(area(L)) < min_area:
            continue
        border_raw = (L[:, 0] <= 0.05) | (L[:, 0] >= W - 0.05) | (L[:, 1] <= 0.05) | (L[:, 1] >= H - 0.05)
        idx = dp_closed_idx(L, tol)
        if len(idx) < 3:
            continue
        idx = fit_curves(L, idx, border_raw, fit_tol)
        S = L[idx]
        if abs(area(S)) < min_area * 0.5:
            continue
        parts.append(smooth_path(S, ring_tangents(L, idx, border_raw)))
        npts += len(S); ncont += 1
    return "".join(parts), npts, ncont


def smooth_ring(L, sigma_idx):
    """Gaussian-smooth a closed ring of points along its index (removes the
    raster's pixel-level wobble; sigma is in samples, ~UP samples per source px)."""
    if sigma_idx <= 0 or len(L) < 8:
        return L
    r = int(math.ceil(sigma_idx * 3))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma_idx) ** 2); k /= k.sum()
    n = len(L)
    idx = (np.arange(n)[:, None] + np.arange(-r, r + 1)[None, :]) % n
    return (L[idx] * k[None, :, None]).sum(1)


def to_source(loops, up, pad, sigma_px=0.0):
    """Index coordinates of the padded, upsampled field -> source pixel coords,
    clamped to the image rectangle."""
    out = []
    for L in loops:
        P = (smooth_ring(L, sigma_px * up * 1.5) + 0.5) / up - pad
        out.append(np.clip(P, [0, 0], [W, H]))
    return out


def ink_path(src, iso=ISO, tol=DP_TOL):
    k = ink_field(src)
    pad = 2
    # replicate the border (a stroke that runs off the frame keeps running), then a
    # clear margin so contours close; the clamp to the frame cuts them flat.
    kp = np.pad(k, pad, mode="edge")
    kp = np.pad(kp, 1, mode="constant")          # 1 more source px of nothing
    pad_total = pad + 1
    F = upsample(kp, UP)
    loops = to_source(marching_squares(F, iso), UP, pad_total, SMOOTH_PX)
    d, npts, nc = contours_to_path(loops, tol, MIN_AREA)
    return d, npts, nc


def skin_path(src):
    m = ST.skin_mask(src).astype(np.float32)
    for _ in range(SKIN_INSET):                    # 4-neighbour erode = ~1 px inset
        e = m.copy()
        e[1:] = np.minimum(e[1:], m[:-1]); e[:-1] = np.minimum(e[:-1], m[1:])
        e[:, 1:] = np.minimum(e[:, 1:], m[:, :-1]); e[:, :-1] = np.minimum(e[:, :-1], m[:, 1:])
        m = e
    pad = 4
    mp = np.pad(m, pad, mode="edge")
    mp = np.pad(mp, 1, mode="constant")
    mp = blur(mp, SKIN_SIGMA)
    F = upsample(mp, UP)
    loops = to_source(marching_squares(F, 0.5), UP, pad + 1)
    big = [L for L in loops if abs(area(L)) >= 50]
    # the silhouette: outer rings only (positive after the walk's orientation is arbitrary,
    # so take rings not contained in a larger one by area sign relative to the biggest)
    big.sort(key=lambda L: -abs(area(L)))
    s0 = np.sign(area(big[0]))
    outer = [L for L in big if np.sign(area(L)) == s0]
    d, npts, nc = contours_to_path(outer, SKIN_DP_TOL, 50)
    return d, npts, nc, len(big) - len(outer)


def vectorize_hand(src, name):
    ink, ni, nci = ink_path(src)
    skin, ns, ncs, holes = skin_path(src)
    print("%s: ink %d contours, %d pts, %d KB; skin %d contour(s), %d pts, %d KB (%d hole ring(s) ignored)"
          % (name, nci, ni, len(ink) // 1024, ncs, ns, len(skin) // 1024, holes))
    return {"viewBox": "0 0 %d %d" % (W, H), "skin": skin, "ink": ink}


def export_vectors():
    out = {name: vectorize_hand(src, name) for name, src in HANDS.items()}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print("handVectors.json: %d KB" % (os.path.getsize(OUT) // 1024))
    return out


# ---------------------------------------------------------------- check
def rsvg(svg, w, h):
    r = subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h)], input=svg.encode(), capture_output=True, check=True)
    return Image.open(io.BytesIO(r.stdout)).convert("RGBA")


def svg_of(hand, box, w, h, skin="#EFC8A8", ink="#2B1A26", bg="#FFFFFF", skin_on=True):
    x, y, bw, bh = box
    s = ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="%d %d %d %d">'
         '<rect x="-10" y="-10" width="2000" height="2000" fill="%s"/>' % (w, h, x, y, bw, bh, bg))
    if skin_on:
        s += '<path d="%s" fill="%s"/>' % (hand["skin"], skin)
    s += '<path d="%s" fill="%s" fill-rule="evenodd"/></svg>' % (hand["ink"], ink)
    return s


def vec_coverage(hand, box, scale):
    x, y, bw, bh = box
    w, h = int(bw * scale), int(bh * scale)
    im = rsvg(svg_of(hand, box, w, h, skin_on=False, ink="#000", bg="#FFF"), w, h).convert("L")
    return 1 - np.array(im, np.float32) / 255


def check(vecs):
    for name, src in HANDS.items():
        hand = vecs[name]
        k = ink_field(src)
        rast = Image.open(src).convert("RGB")
        full = (0, 0, W, H)
        cov = vec_coverage(hand, full, 1)
        diff = cov - k
        ink_ratio = cov.sum() / k.sum()
        print("%s 1x: mean|cov-k| %.4f  ink mass vec/raster %.3f  rms %.3f  px>0.5 off: %d"
              % (name, np.abs(diff).mean(), ink_ratio, math.sqrt((diff ** 2).mean()), int((np.abs(diff) > 0.5).sum())))
        # thickness: compare mass of thresholded sets along a few rows
        # overlay at 1x: raster in grey, vector in red (multiply)
        g = (255 - k * 200).astype(np.uint8)
        base = np.stack([g, g, g], 2).astype(np.float32)
        red = np.array([230, 20, 20], np.float32)
        a = (cov * 0.55)[..., None]
        ov = base * (1 - a) + red * a
        Image.fromarray(ov.astype(np.uint8)).save(os.path.join(ORIG, "vec-check-%s-overlay1x.png" % name))
        # signed difference heat map: red = vector darker, blue = raster darker
        dd = np.clip(diff, -1, 1)
        hm = np.full((H, W, 3), 255, np.float32)
        hm[..., 1] -= np.abs(dd) * 255;
        hm[..., 0] -= np.where(dd < 0, np.abs(dd) * 255, 0)
        hm[..., 2] -= np.where(dd > 0, np.abs(dd) * 255, 0)
        Image.fromarray(np.clip(hm, 0, 255).astype(np.uint8)).save(os.path.join(ORIG, "vec-check-%s-diff1x.png" % name))
        # 1x and 4x crops: raster upscaled (bicubic) vs vector, tinted
        crops = {"nailHand": [("thumb", (130, 20, 150, 150)), ("index", (270, 340, 150, 150)), ("knuckle", (110, 230, 120, 90)), ("junction", (220, 420, 150, 130))],
                 "openHand": [("middle", (420, 10, 150, 150)), ("thumb", (810, 560, 150, 150)), ("knuckle", (400, 520, 150, 80))]}[name]
        for tag, box in crops:
            x, y, bw, bh = box
            for sc in (1, 4):
                w, h = bw * sc, bh * sc
                r_up = rast.crop((x, y, x + bw, y + bh)).resize((w, h), Image.BICUBIC)
                v = rsvg(svg_of(hand, box, w, h, skin="#FFFFFF", ink="#2B1A26"), w, h).convert("RGB")
                tile = Image.new("RGB", (w * 2 + 10, h), (255, 0, 255))
                tile.paste(r_up, (0, 0)); tile.paste(v, (w + 10, 0))
                tile.save(os.path.join(ORIG, "vec-check-%s-%s-%dx.png" % (name, tag, sc)))
        # skin fill on a tone, whole hand, with a loud background to see gaps
        sk = rsvg(svg_of(hand, full, 512, 768, skin="#EFC8A8", ink="#2B1A26", bg="#00C8FF"), 512, 768).convert("RGB")
        sk.save(os.path.join(ORIG, "vec-check-%s-skin.png" % name))


if __name__ == "__main__":
    vecs = export_vectors()
    if "--check" in sys.argv:
        check(vecs)
