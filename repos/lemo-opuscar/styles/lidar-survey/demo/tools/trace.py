"""Snap the hand-digitised walls (data/walls_traced.json) to the ridge crest of the local relief model and measure them.
usage: trace.py <work_dir> <data_dir>   (needs work_dir/walls.npz from walls.py)"""
import json, math, os, sys
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
import terrain as T
work, data = sys.argv[1], sys.argv[2]
lrm = np.load(os.path.join(work, "walls.npz"))["lrm"]; res = 0.5
lrs = ndimage.gaussian_filter(lrm, 1.0)
H, W = lrm.shape
def samp(a, x, y):
    return ndimage.map_coordinates(a, [[(y - T.Y0) / res], [(x - T.X0) / res]], order=1)[0]
src = json.load(open(os.path.join(data, "walls_traced.json")))
out = {}; total = 0.0; crest = []
for k, pl in src["walls"].items():
    pts = []
    for (x0, y0), (x1, y1) in zip(pl[:-1], pl[1:]):
        L = math.hypot(x1 - x0, y1 - y0); n = max(2, int(L / 1.0))
        for i in range(n):
            t = i / n; pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, (x1 - x0) / L, (y1 - y0) / L))
    pts.append((pl[-1][0], pl[-1][1], pts[-1][2], pts[-1][3]))
    snapped = []
    for x, y, dx, dy in pts:
        nx, ny = -dy, dx
        offs = np.linspace(-2.5, 2.5, 21)
        v = np.array([samp(lrs, x + nx * o, y + ny * o) for o in offs])
        o = offs[np.argmax(v)]
        snapped.append((x + nx * o, y + ny * o, float(v.max())))
    s = np.array(snapped)
    # smooth the offsets along the wall so the line stays straight where the wall is
    s[:, 0] = ndimage.gaussian_filter1d(s[:, 0], 6, mode="nearest"); s[:, 1] = ndimage.gaussian_filter1d(s[:, 1], 6, mode="nearest")
    L = float(np.hypot(np.diff(s[:, 0]), np.diff(s[:, 1])).sum())
    total += L
    out[k] = dict(pts=[[round(a, 2), round(b, 2)] for a, b, _ in s[::2]] + [[round(s[-1, 0], 2), round(s[-1, 1], 2)]], length=round(L, 1), crest_lrm=round(float(np.median(s[:, 2])), 3))
print("walls", len(out), "total length m", round(total, 1))
for k, v in out.items(): print(k, v["length"], v["crest_lrm"])
json.dump(dict(total_m=round(total, 1), walls=out), open(os.path.join(data, "walls.json"), "w"))
img = np.clip(0.5 + lrm / 0.7, 0, 1)[::-1]
im = Image.fromarray((img * 255).astype(np.uint8)).convert("RGB"); dr = ImageDraw.Draw(im)
for k, v in out.items():
    p = [((a - T.X0) / res, H - 1 - (b - T.Y0) / res) for a, b in v["pts"]]
    dr.line(p, fill=(255, 140, 0), width=2); dr.text(p[0], k, fill=(255, 255, 0))
im.crop((int((-180 - T.X0) / res), int(H - 1 - (480 - T.Y0) / res), int((270 - T.X0) / res), int(H - 1 - (-360 - T.Y0) / res))).save(os.path.join(work, "trace_review.png"))
