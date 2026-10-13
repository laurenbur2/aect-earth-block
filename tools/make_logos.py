#!/usr/bin/env python3
"""Build web logo variants from AECT's original logo (navy box, cream type, green globe).

  logo-badge.png  tight crop, original navy background (for light backgrounds)
  logo-light.png  navy removed, original cream/green artwork on transparent (for dark backgrounds)
  logo-mark.png   square crop of the badge for favicons / social

Usage: python3 tools/make_logos.py <original-logo.png>
"""
import sys, pathlib
import numpy as np
from PIL import Image

src = Image.open(sys.argv[1]).convert("RGBA")
a = np.asarray(src).astype(np.float32)
rgb = a[..., :3]
bg = np.median(rgb.reshape(-1, 3), axis=0)  # the navy background
dist = np.linalg.norm(rgb - bg, axis=2)
ink = dist > 80  # 40 picks up a faint artifact along the bottom edge of the original
ys, xs = np.where(ink)
pad = 34
x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, a.shape[1])
y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, a.shape[0])
out = pathlib.Path(__file__).resolve().parent.parent / "site/assets/img"
out.mkdir(parents=True, exist_ok=True)

badge = src.crop((x0, y0, x1, y1))
badge.save(out / "logo-badge.png", optimize=True)

# Un-premultiply against the navy so anti-aliased edges keep the original ink color.
fg_dist = np.percentile(dist[ink], 95)
alpha = np.clip(dist / fg_dist, 0, 1)
safe = np.maximum(alpha, 1e-3)[..., None]
color = np.clip((rgb - bg * (1 - alpha[..., None])) / safe, 0, 255)
light = np.dstack([color, alpha * 255]).astype(np.uint8)
light_img = Image.fromarray(light).crop((x0 + pad - 4, y0 + pad - 4, x1 - pad + 4, y1 - pad + 4))
light_img.save(out / "logo-light.png", optimize=True)

# Favicon: just the big "AECT" wordmark (the tallest band of ink rows), on the original navy.
rows = ink.any(axis=1)
bands, start = [], None
for y, on in enumerate(list(rows) + [False]):
    if on and start is None: start = y
    if not on and start is not None: bands.append((start, y)); start = None
wy0, wy1 = max(bands, key=lambda b: b[1] - b[0])
wx = np.where(ink[wy0:wy1].any(axis=0))[0]
word = src.crop((wx.min(), wy0, wx.max() + 1, wy1))
side = int(max(word.size) * 1.18)
sq = Image.new("RGBA", (side, side), tuple(int(c) for c in bg) + (255,))
sq.paste(word, ((side - word.width) // 2, (side - word.height) // 2))
sq.resize((256, 256), Image.LANCZOS).save(out / "logo-mark.png", optimize=True)
sq.resize((32, 32), Image.LANCZOS).save(out / "favicon-32.png", optimize=True)
sq.resize((180, 180), Image.LANCZOS).save(out / "apple-touch-icon.png", optimize=True)
print("badge", badge.size, "light", light_img.size, "bg", bg.round())
