"""Sample a flat atlas through the baked UV pass. This is the whole trick."""
import numpy as np


def bilinear(tex, uv, mask):
    """tex (TH,TW,C) float, uv (H,W,2) in 0..1 -> (H,W,C)."""
    TH, TW = tex.shape[:2]
    x = np.clip(uv[..., 0], 0, 1) * (TW - 1)
    y = np.clip(uv[..., 1], 0, 1) * (TH - 1)
    x0 = np.floor(x).astype(np.int32); y0 = np.floor(y).astype(np.int32)
    x1 = np.minimum(x0 + 1, TW - 1);   y1 = np.minimum(y0 + 1, TH - 1)
    fx = (x - x0)[..., None];          fy = (y - y0)[..., None]
    out = ((tex[y0, x0] * (1 - fx) + tex[y0, x1] * fx) * (1 - fy)
           + (tex[y1, x0] * (1 - fx) + tex[y1, x1] * fx) * fy)
    return out * mask[..., None]
