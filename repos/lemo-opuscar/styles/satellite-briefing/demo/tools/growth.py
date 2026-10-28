"""North Aral: where the water came back between 2001 and 2009, ordered by distance from the 2001 shore,
so the shader can grow the 2009 water outward from the old edge (assets/plates/ko_grow.png).
R = 0 where nothing changes, else 1..255 = how far (normalised) the new water lies from the 2001 water.
usage: python -I tools/growth.py <demo_dir>"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage

D = sys.argv[1]
PL = os.path.join(D, 'assets/plates')
m01 = np.asarray(Image.open(os.path.join(PL, 'ko2001_w.png')), np.float32) / 255 > .5
m09 = np.asarray(Image.open(os.path.join(PL, 'ko2009_w.png')), np.float32) / 255 > .5
new = m09 & ~m01
new = ndimage.binary_opening(new, iterations=1)
dist = ndimage.distance_transform_edt(~m01)          # pixels from the 2001 water
g = np.zeros(m01.shape, np.float32)
if new.any():
    d = dist[new]; top = np.percentile(d, 97)
    g[new] = np.clip(d / max(top, 1), 0.004, 1)
g = ndimage.gaussian_filter(g, 1.0) * ndimage.gaussian_filter(new.astype(np.float32), 1.0) / np.maximum(ndimage.gaussian_filter(new.astype(np.float32), 1.0), 1e-3)
out = np.where(new | (g > 0.01), np.clip(g * 254 + 1, 1, 255), 0).astype(np.uint8)
Image.fromarray(out).save(os.path.join(PL, 'ko_grow.png'))
print('new water px', int(new.sum()), 'max distance px', float(dist[new].max()) if new.any() else 0)
