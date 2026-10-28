"""Cross-section of one wall from the raw ground returns: points within a strip, offset across the wall, detrended.
usage: profile.py <raw_dir> <data_dir> <wall> <along0> <along1>   (writes data/profile.json)"""
import json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import terrain as T
raw, data, wall, a0, a1 = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5])
pl = np.array(json.load(open(os.path.join(data, "walls.json")))["walls"][wall]["pts"])
seg = np.hypot(*np.diff(pl, axis=0).T); cum = np.r_[0, np.cumsum(seg)]
def at(s):
    i = min(np.searchsorted(cum, s) - 1, len(seg) - 1); i = max(i, 0); t = (s - cum[i]) / seg[i]
    p = pl[i] + (pl[i + 1] - pl[i]) * t; dv = (pl[i + 1] - pl[i]) / seg[i]; return p, dv
d = T.points(raw); g = d["c"] == 2
gx, gy, gz = d["x"][g], d["y"][g], d["z"][g]
offs, zs = [], []
for s in np.arange(a0, a1, 1.0):
    p, dv = at(s); n = np.array([-dv[1], dv[0]])
    rx, ry = gx - p[0], gy - p[1]
    al = rx * dv[0] + ry * dv[1]; of = rx * n[0] + ry * n[1]
    m = (np.abs(al) < 0.5) & (np.abs(of) < 7)
    if m.sum() < 5: continue
    o, z = of[m], gz[m]
    sh = np.abs(o) > 3.5
    A = np.c_[o[sh], np.ones(sh.sum())]; coef = np.linalg.lstsq(A, z[sh], rcond=None)[0]
    offs += list(o); zs += list(z - (coef[0] * o + coef[1]))
offs, zs = np.array(offs), np.array(zs)
bins = np.arange(-7, 7.01, 0.5); mid = (bins[:-1] + bins[1:]) / 2
med = np.array([np.median(zs[(offs >= b0) & (offs < b1)]) if ((offs >= b0) & (offs < b1)).sum() > 3 else np.nan for b0, b1 in zip(bins[:-1], bins[1:])])
height = float(np.nanmax(med))
above = mid[med > 0.15 * height]
width = float(above.max() - above.min() + 0.5)
half = mid[med >= 0.5 * height]; fwhm = float(half.max() - half.min() + 0.5)   # full width at half height
pc, dv = at((a0 + a1) / 2)
lon, lat = T.lonlat(pc[0], pc[1])
print(f"{wall} {a0}-{a1}: points {len(zs)} height {height:.2f} m fwhm {fwhm:.1f} m base {width:.2f} m centre {lat:.5f},{lon:.5f}")
rng = np.random.default_rng(3); k = rng.choice(len(zs), min(900, len(zs)), replace=False)
json.dump(dict(wall=wall, along=[a0, a1], centre=[round(float(pc[0]), 2), round(float(pc[1]), 2)], dir=[round(float(dv[0]), 4), round(float(dv[1]), 4)],
               lat=round(lat, 5), lon=round(lon, 5), height=round(height, 2), width=round(width, 1), fwhm=round(fwhm, 1), n=int(len(zs)),
               bins=[round(float(x), 2) for x in mid], median=[None if np.isnan(v) else round(float(v), 3) for v in med],
               pts=[[round(float(offs[i]), 2), round(float(zs[i]), 3)] for i in k]),
          open(os.path.join(data, f"profile_{wall}.json"), "w"))
