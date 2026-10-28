"""Measure a hepatocyte nucleus in the 0.25 um/px plate. On 72 rays from the centre: the darkest point between
2 and 5 um (the nuclear membrane), then the outer edge where brightness climbs half way back to the cytoplasm
just outside; the edge points are fitted with a circle (least squares, outliers dropped). d = outer diameter.
usage: .venv/bin/python -I tools/nucleus.py <film_dir> x y   (approximate centre, level-0 px)
prints JSON {cx, cy, r_px, d_um, rays, rms_px} and writes it to assets/plates/nucleus.json"""
import sys, json, os
import numpy as np
from PIL import Image
from scipy import ndimage
D = sys.argv[1]; X, Y = float(sys.argv[2]), float(sys.argv[3])
Image.MAX_IMAGE_PIXELS = None
P = json.load(open(os.path.join(D, 'assets/plates/plates.json')))
pl = [p for p in P['plates'] if p['name'] == 'c025'][0]
im = np.asarray(Image.open(os.path.join(D, pl['file']))).astype(np.float32)
g = ndimage.gaussian_filter(im.mean(2), 1.0)
cx, cy = X - pl['x'], Y - pl['y']
ang = np.radians(np.arange(0, 360, 5))
rs = np.arange(0, 26, 0.25)
for it in range(6):
    pts = []
    for a in ang:
        xs, ys = cx + rs * np.cos(a), cy + rs * np.sin(a)
        prof = ndimage.map_coordinates(g, [ys, xs], order=1)
        lo, hi = int(8 / 0.25), int(20 / 0.25)            # membrane between r = 8 and 20 px (2-5 um)
        km = lo + int(np.argmin(prof[lo:hi]))
        kx = min(len(prof) - 1, km + 24)
        top = prof[km:kx + 1].max()
        half = (prof[km] + top) / 2
        k = km + int(np.argmax(prof[km:kx + 1] >= half))
        pts.append((xs[k], ys[k]))
    pts = np.array(pts)
    A = np.c_[2 * pts, np.ones(len(pts))]; b = (pts ** 2).sum(1)
    sol = np.linalg.lstsq(A, b, rcond=None)[0]
    ncx, ncy = sol[0], sol[1]; r = np.sqrt(sol[2] + ncx ** 2 + ncy ** 2)
    res = np.hypot(pts[:, 0] - ncx, pts[:, 1] - ncy) - r
    keep = np.abs(res) < 2.5 * np.median(np.abs(res)) + 0.5
    pts = pts[keep]
    A = np.c_[2 * pts, np.ones(len(pts))]; b = (pts ** 2).sum(1)
    sol = np.linalg.lstsq(A, b, rcond=None)[0]
    cx, cy = sol[0], sol[1]; r = float(np.sqrt(sol[2] + cx ** 2 + cy ** 2))
out = dict(cx=float(cx + pl['x']), cy=float(cy + pl['y']), r_px=r, d_um=2 * r * P['mpp0'], rays=int(keep.sum()),
           rms_px=float(np.sqrt(np.mean((np.hypot(pts[:, 0] - cx, pts[:, 1] - cy) - r) ** 2))))
print(json.dumps(out))
json.dump(out, open(os.path.join(D, 'assets/plates/nucleus.json'), 'w'), indent=1)
