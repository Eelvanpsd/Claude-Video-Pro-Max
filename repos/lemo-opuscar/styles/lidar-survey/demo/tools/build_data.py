"""Build the film's data from the cached USGS 3DEP points (public domain) and the NAIP 2016 photo.
usage: build_data.py <raw_dir> <work_dir> <data_dir> <out_dir>
  raw_dir   assets/raw/ept (EPT nodes)          work_dir  assets/raw/work (dtm.npy, walls.npz from walls.py)
  data_dir  data/ (walls.json, profile_C.json)   out_dir   assets/raw/build (binaries the page loads)
Writes points.bin, ground.bin (DTM 0.5 m + normals + light + wall field), canopy.bin (canopy surface 1 m),
and data/facts.json (every number on screen, measured here)."""
import json, math, os, sys
import numpy as np
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
import terrain as T
raw, work, data, out = sys.argv[1:5]
os.makedirs(out, exist_ok=True)
d = T.points(raw)
N = len(d["z"])
inside = (d["x"] > T.X0) & (d["x"] < T.X1) & (d["y"] > T.Y0) & (d["y"] < T.Y1)
for k in d: d[k] = d[k][inside]
N = len(d["z"]); print("points", N)
z = np.load(os.path.join(work, "dtm.npy")).astype(np.float64); RES = 0.5
H, W = z.shape
def dtm_at(x, y):
    return ndimage.map_coordinates(z, [(y - T.Y0) / RES, (x - T.X0) / RES], order=1, mode="nearest")
hag = d["z"] - dtm_at(d["x"], d["y"])
cls = np.where(d["c"] == 2, 0, np.where(d["c"] == 9, 2, 1)).astype(np.uint8)   # 0 ground, 1 vegetation/other, 2 water
veg = cls == 1
# ---------------- points.bin ----------------
OX, OY, OZ, SXY, SZ = T.X0, T.Y0, 150.0, 0.02, 0.01
rng = np.random.default_rng(11); order = rng.permutation(N)
q = lambda a: a[order]
qx = np.round((d["x"] - OX) / SXY).astype("<u2"); qy = np.round((d["y"] - OY) / SXY).astype("<u2")
qz = np.round((np.clip(d["z"], OZ, 800) - OZ) / SZ).astype("<u2")
qh = np.clip(np.round(np.clip(hag, 0, None) * 8), 0, 255).astype(np.uint8)
it = d["i"].astype(float); lo, hi = np.percentile(it, [2, 98]); qi = (np.clip((it - lo) / (hi - lo), 0, 1) * 255).astype(np.uint8)
qr = rng.integers(0, 256, N).astype(np.uint8)
with open(os.path.join(out, "points.bin"), "wb") as f:
    f.write(np.array([N], "<u4").tobytes())
    f.write(np.stack([q(qx), q(qy), q(qz)], 1).astype("<u2").tobytes())
    f.write(q(qh).tobytes()); f.write(q(cls).tobytes()); f.write(q(qi).tobytes()); f.write(qr.tobytes())
# ---------------- ground.bin : DTM 0.5 m with the micro-relief exaggerated x3 for display ----------------
EXAG = 2.0
lrm = z - ndimage.gaussian_filter(z, 5 / RES)
zd = ndimage.gaussian_filter(z, 0.5) + (EXAG - 1) * ndimage.gaussian_filter(lrm, 0.8)                                   # display surface: local relief x3, landform x1
gy, gx = np.gradient(ndimage.gaussian_filter(zd, 0.6), RES)
nx, ny, nz = -gx, np.ones_like(zd), gy                       # three.js axes: x east, y up, z south
nl = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
nq = np.clip(np.round(np.stack([nx, ny, nz], -1) / nl[..., None] * 127), -127, 127).astype(np.int8)
# ambient occlusion on the display surface, short radius (micro relief)
ao = np.zeros_like(zd); ND = 10
for k in range(ND):
    a = 2 * math.pi * k / ND; ca, sa = math.cos(a), math.sin(a); hmax = np.zeros_like(zd)
    for r in (1, 2, 4, 7, 11, 16):
        ox, oy = int(round(ca * r)), int(round(sa * r))
        sh = np.roll(np.roll(zd, -oy, 0), -ox, 1)
        hmax = np.maximum(hmax, np.arctan2(sh - zd, r * RES))
    ao += 1 - np.sin(np.clip(hmax, 0, math.pi / 2))
ao = ndimage.gaussian_filter(ao / ND, 0.7)
# wall field: distance to the nearest traced wall (m) and that wall point's reveal order (0..1)
walls = json.load(open(os.path.join(data, "walls.json")))["walls"]
reveal_order = ["A", "B", "E", "F", "C", "D", "J", "G", "L", "H", "I", "K", "N9", "N7", "N5", "N4", "N8", "N6", "N3", "N2", "N1", "N10"]
seed = np.zeros((H, W), bool); val = np.zeros((H, W))
for wi, k in enumerate(reveal_order):
    pl = np.array(walls[k]["pts"]); seglen = np.hypot(*np.diff(pl, axis=0).T); cum = np.r_[0, np.cumsum(seglen)]
    for (x0, y0), (x1, y1), c0, L in zip(pl[:-1], pl[1:], cum[:-1], seglen):
        n = max(2, int(L / 0.25))
        for t in np.linspace(0, 1, n):
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            i, j = int(round((y - T.Y0) / RES)), int(round((x - T.X0) / RES))
            if 0 <= i < H and 0 <= j < W:
                seed[i, j] = True
                val[i, j] = (wi + (c0 + L * t) / cum[-1]) / len(reveal_order)
dist, (ii, jj) = ndimage.distance_transform_edt(~seed, return_indices=True)
dist *= RES; wval = val[ii, jj]
zc = np.round((np.clip(zd, OZ, 800) - OZ) / SZ).astype("<u2")
light = np.stack([np.clip(ao * 255, 0, 255), np.clip(dist / 6 * 255, 0, 255), np.clip(wval * 255, 0, 255),
                  np.clip(128 + lrm / 0.6 * 127, 0, 255)], -1).astype(np.uint8)
with open(os.path.join(out, "ground.bin"), "wb") as f:
    f.write(np.array([W, H], "<u4").tobytes()); f.write(np.array([T.X0, T.Y0, RES, OZ, SZ], "<f4").tobytes())
    f.write(zc.tobytes()); f.write(nq.tobytes()); f.write(light.tobytes())
# ---------------- canopy.bin : top-of-canopy surface 1 m, for the photo ----------------
CR = 1.0; CW = int((T.X1 - T.X0) / CR) + 1; CH = int((T.Y1 - T.Y0) / CR) + 1
ix = np.clip(((d["x"] - T.X0) / CR).astype(int), 0, CW - 1); iy = np.clip(((d["y"] - T.Y0) / CR).astype(int), 0, CH - 1)
top = np.full((CH, CW), -1e9); np.maximum.at(top, (iy, ix), d["z"])
emp = top < -1e8
_, (a, b) = ndimage.distance_transform_edt(emp, return_indices=True); top = top[a, b]
top = ndimage.grey_closing(top, size=(3, 3)); top = ndimage.gaussian_filter(top, 1.4)
zground1 = ndimage.zoom(z, (CH / H, CW / W), order=1)[:CH, :CW]
top = np.maximum(top, zground1 + 0.3)
with open(os.path.join(out, "canopy.bin"), "wb") as f:
    f.write(np.array([CW, CH], "<u4").tobytes()); f.write(np.array([T.X0, T.Y0, CR, OZ, SZ], "<f4").tobytes())
    f.write(np.round((top - OZ) / SZ).astype("<u2").tobytes())
# ---------------- facts ----------------
W_ = json.load(open(os.path.join(data, "walls.json"))); P = json.load(open(os.path.join(data, "profile_C.json")))
area = (T.X1 - T.X0) * (T.Y1 - T.Y0)
hv = hag[veg & (hag > 2)]
hist, _ = np.histogram(np.clip(hag[veg], 0, 40), bins=np.arange(0, 40.01, 0.25))
facts = dict(
    points=int(N), area_km2=round(area / 1e6, 3), density=round(N / area, 1),
    ground=int((cls == 0).sum()), ground_share=round(float((cls == 0).mean()) * 100, 1),
    veg=int(veg.sum()), canopy_p95=round(float(np.percentile(hv, 95)), 1), canopy_max=round(float(np.percentile(hv, 99.9)), 1),
    veg_hag_hist=hist.tolist(),
    walls_total_m=W_["total_m"], walls_count=len(W_["walls"]),
    profile=dict(wall=P["wall"], height=P["height"], width_half=P["fwhm"], n=P["n"], along=P["along"], centre=P["centre"], dir=P["dir"], lat=P["lat"], lon=P["lon"]),
    exag=EXAG, origin=dict(lat=T.LAT0, lon=T.LON0), box=T.BOX,
    terrain=dict(min=round(float(z.min()), 1), max=round(float(z.max()), 1)),
    quant=dict(OX=OX, OY=OY, OZ=OZ, SXY=SXY, SZ=SZ),
    dataset="USGS 3DEP USGS_LPC_CT_Statewide_B8_2016 (EPT, all returns)",
)
json.dump(facts, open(os.path.join(data, "facts.json"), "w"), indent=1)
print({k: v for k, v in facts.items() if k != "veg_hag_hist"})
