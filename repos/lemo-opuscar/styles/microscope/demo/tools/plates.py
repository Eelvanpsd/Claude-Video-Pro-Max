"""Build every image plate and every measurement of the film from the whole-slide image (Ventana-1.bif, CC0).

usage: .venv/bin/python -I tools/plates.py <demo_dir>
in : assets/raw/Ventana-1.bif, config.json (ROI centres, nucleus guess, measuring roll)
out: assets/plates/*.jpg|png, assets/plates/plates.json (geometry + measurements)

World coordinates are level-0 scan pixels (0.25 um/px, XMP ScanRes="0.25").
Plates (all through the same grade(), so the hand-over between them is invisible):
  slide        the scanner's own photo of the whole glass slide (TIFF page "Label_Image", 21.167 um/px), cut out of
               the scanner tray, destriped, the slide maker's printed logo filled with the surrounding frosted glass
  a8 a4 a2     the whole scanned area at 8 / 4 / 2 um/px (levels 5, 4, 3), alpha-feathered by 0.3 mm
  c1           the whole scanned area at 1 um/px (level 2)
  c05 c025     crops around the nucleus at 0.5 / 0.25 um/px (levels 1, 0)
  roiA roiB    the counted collagen pixels inside each 1 mm measuring circle (RGBA, 1 um/px)
Measurements: the tissue's long axis, the collagen share inside each circle (with the scan's cumulative curve).
"""
import sys, os, json, re
import numpy as np
import tifffile
from PIL import Image
from scipy import ndimage

D = sys.argv[1]
OUT = os.path.join(D, 'assets', 'plates'); os.makedirs(OUT, exist_ok=True)
CFG = json.load(open(os.path.join(D, 'config.json')))
BIF = os.path.join(D, 'assets', 'raw', 'Ventana-1.bif')
T = tifffile.TiffFile(BIF)
RAW = open(BIF, 'rb')                                   # tile bytes are read directly
PAGES = {0: 2, 1: 3, 2: 4, 3: 5, 4: 6, 5: 7}          # pyramid level -> TIFF page
MPP0 = 0.25
N = CFG['nucleus_guess']
CROP = (5120, 3584)


def region(level, x0, y0, w, h):
    """Read a box of a tiled pyramid level (plate pixels), decoding only the tiles it needs."""
    p = T.pages[PAGES[level]]
    tw, th = p.tilewidth, p.tilelength
    nx = -(-p.imagewidth // tw)
    out = np.zeros((h, w, 3), np.uint8)
    for ty in range(max(0, y0 // th), min(p.imagelength - 1, y0 + h - 1) // th + 1):
        for tx in range(max(0, x0 // tw), min(p.imagewidth - 1, x0 + w - 1) // tw + 1):
            i = ty * nx + tx
            RAW.seek(p.dataoffsets[i])
            tile = p.decode(RAW.read(p.databytecounts[i]), i, jpegtables=p.jpegtables)[0][0]
            X, Y = tx * tw, ty * th
            sx0, sy0 = max(x0, X), max(y0, Y)
            sx1, sy1 = min(x0 + w, X + tw), min(y0 + h, Y + th)
            out[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = tile[sy0 - Y:sy1 - Y, sx0 - X:sx1 - X, :3]
    return out


def glass_ref(img):
    a = img.reshape(-1, 3).astype(np.float32)
    m = (a.min(1) > 200) & (a.max(1) - a.min(1) < 14)
    return np.median(a[m], 0)


# ---------------------------------------------------------------- grade
L5 = T.pages[PAGES[5]].asarray()[..., :3]
G_WSI = glass_ref(L5)
WHITE = np.array([244, 241, 236], np.float32)          # warm paper-white glass


def grade(img, glass):
    x = img.astype(np.float32) / glass                 # glass -> 1.0
    x = np.clip(x, 0, 1.03)
    x = x ** 1.12                                       # a little more density in the stain
    lum = x @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    x = lum[..., None] + (x - lum[..., None]) * 1.10    # +10 % chroma
    x = np.clip(x, 0, 1) * WHITE
    return np.clip(x + 0.5, 0, 255).astype(np.uint8)


plates = []
def save(name, img, x0, y0, sc, alpha=None, q=92):
    if alpha is not None:
        rgba = np.dstack([img, (np.clip(alpha, 0, 1) * 255 + 0.5).astype(np.uint8)])
        fn = name + '.png'; Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, fn), compress_level=6)
    else:
        fn = name + '.jpg'; Image.fromarray(img).save(os.path.join(OUT, fn), quality=q, subsampling=0)
    plates.append(dict(name=name, file='assets/plates/' + fn, x=float(x0), y=float(y0), s=float(sc), w=img.shape[1], h=img.shape[0]))
    print(f'{name:6s} {img.shape[1]} x {img.shape[0]}  {sc * MPP0:.3f} um/px')


# ---------------------------------------------------------------- the slide photo: registration
LBL = T.pages[0].asarray()[..., :3]
xr = T.pages[0].tags['XResolution'].value
MPP_L = 1e4 / (xr[0] / xr[1])                           # px/cm -> um/px
xmp = T.pages[0].tags['XMP'].value
xmp = xmp.decode('utf-8', 'replace') if isinstance(xmp, bytes) else xmp
aoi = dict(re.findall(r'(Left|Top|Right|Bottom)="(\d+)"', xmp.split('<AOI0')[1]))
lx, ly = int(aoi['Left']), LBL.shape[0] - int(aoi['Top'])   # AOI0 in photo px, y counted from the bottom
K = MPP_L / MPP0                                        # level-0 px per photo px


def tissue_centroid(img, mpp, it):
    g = img.astype(np.float32).mean(2); glass = np.median(g[g > np.percentile(g, 60)])
    m = ndimage.binary_closing(g < 0.85 * glass, iterations=it)
    lab, n = ndimage.label(m); big = np.argmax(ndimage.sum(m, lab, range(1, n + 1))) + 1
    ys, xs = np.nonzero(ndimage.binary_fill_holes(lab == big))
    return np.array([xs.mean(), ys.mean()]) * mpp, len(xs) * mpp * mpp


c_ph, a_ph = tissue_centroid(LBL[1200:1800], MPP_L, 1); c_ph += [0, 1200 * MPP_L]
c_sc, a_sc = tissue_centroid(T.pages[PAGES[3]].asarray()[..., :3], 8 * MPP0, 6)
reg_err = float(np.hypot(*(c_ph - (np.array([lx, ly]) * MPP_L + c_sc))))
reg_area = float(np.sqrt(a_sc / a_ph))
print(f'slide photo {MPP_L:.3f} um/px, scan origin (AOI0) at photo px ({lx},{ly}); '
      f'tissue centroid mismatch {reg_err:.0f} um, area ratio {reg_area:.3f}')
assert reg_err < 150 and abs(reg_area - 1) < 0.03, 'slide photo and scan do not line up'

# ---------------------------------------------------------------- the slide photo: cut out and clean
SX0, SX1, SY0, SY1 = 28, 1232, 56, 3605                 # the glass edges in the photo
ph = LBL.astype(np.float32).copy()
H, W = ph.shape[:2]
# scanner tray bars over the two label-end corners: continue the frosted glass row by row
for y in range(SY0, 334):
    ph[y, SX0:74] = ph[y, 74:80].mean(0)
    ph[y, 1176:SX1 + 1] = ph[y, 1170:1176].mean(0)
# clips of the tray at the far end (dark): replace with the glass of the same row
yy, xx = np.mgrid[0:H, 0:W]
corner = (yy > 3280) & ((xx < 290) | (xx > 960))
dark = ndimage.binary_dilation((ph.mean(2) < 200) & corner, iterations=8) & corner
for y in np.unique(np.nonzero(dark)[0]):
    row = ph[y, SX0:SX1 + 1]; ok = ~dark[y, SX0:SX1 + 1]
    if ok.sum() > 50: ph[y, SX0:SX1 + 1][~ok] = np.median(row[ok], 0)
    else: ph[y, SX0:SX1 + 1] = ph[y - 1, SX0:SX1 + 1]
# the slide maker's printed logo between label and cover glass: fill with the frosted strip of the same row
LY0, LY1, LX0, LX1 = 1010, 1109, 262, 1016
rng = np.random.default_rng(7)
for y in range(LY0, LY1):
    ref = np.concatenate([ph[y, 84:256], ph[y, 1022:1168]])
    ph[y, LX0:LX1] = np.median(ref, 0) + rng.normal(0, 1.2, (LX1 - LX0, 1))
# destripe the cover glass: vertical streaks of the photo's line sensor, measured on glass rows only
gl = ph[1130:3300, SX0:SX1 + 1].mean(2)
dev = gl - np.median(gl, 1, keepdims=True)
col = np.median(dev, 0)
col = col - ndimage.uniform_filter1d(col, 61)           # keep only the narrow streaks
ph[1118:3490, SX0:SX1 + 1] -= col[None, :, None]
# alpha: the glass rectangle with slightly rounded corners
r = 10
inside = (xx >= SX0) & (xx <= SX1) & (yy >= SY0) & (yy <= SY1)
for cx, cy in ((SX0 + r, SY0 + r), (SX1 - r, SY0 + r), (SX0 + r, SY1 - r), (SX1 - r, SY1 - r)):
    corner = (np.abs(xx - cx) <= r) & (np.abs(yy - cy) <= r) & ((xx - cx) * np.sign(cx - W / 2) > 0) & ((yy - cy) * np.sign(cy - H / 2) > 0)
    inside &= ~(corner & ((xx - cx) ** 2 + (yy - cy) ** 2 > r * r))
alpha = ndimage.gaussian_filter(inside.astype(np.float32), 0.8)
G_L = glass_ref(LBL[1150:1800, 80:1150])
slide = grade(np.clip(ph, 0, 255), G_L)
save('slide', slide, (0 - lx) * K, (0 - ly) * K, K, alpha=alpha)

# ---------------------------------------------------------------- whole scan area, feathered
for lev, name in ((5, 'a8'), (4, 'a4'), (3, 'a2')):
    img = T.pages[PAGES[lev]].asarray()[..., :3]
    h, w = img.shape[:2]; sc = 2 ** lev
    feather = 300 / MPP0 / sc
    yy2, xx2 = np.mgrid[0:h, 0:w]
    d = np.minimum(np.minimum(xx2, w - 1 - xx2), np.minimum(yy2, h - 1 - yy2)).astype(np.float32)
    a = np.clip(d / feather, 0, 1); a = a * a * (3 - 2 * a)
    save(name, grade(img, G_WSI), 0, 0, sc, alpha=a)

L2 = T.pages[PAGES[2]].asarray()[..., :3]
save('c1', grade(L2, G_WSI), 0, 0, 4, q=90)

for lev, name in ((1, 'c05'), (0, 'c025')):
    sc = 2 ** lev
    x0, y0 = int(round(N[0] / sc - CROP[0] / 2)), int(round(N[1] / sc - CROP[1] / 2))
    save(name, grade(region(lev, x0, y0, *CROP), G_WSI), x0 * sc, y0 * sc, sc)

# ---------------------------------------------------------------- collagen: counted on level 2 (1 um/px)
a = L2.astype(np.int16)
R_, G_, B_ = a[..., 0], a[..., 1], a[..., 2]
lum = 0.2126 * R_ + 0.7152 * G_ + 0.0722 * B_
tissue = (lum < 200) | ((a.max(2) - a.min(2)) > 40)      # not bare glass
blue = tissue & (B_ > R_ + 12) & (B_ >= G_)              # trichrome blue: collagen
th = np.radians(CFG['measure_roll_deg'])
u = np.array([np.cos(th), -np.sin(th)])                  # world direction that runs left -> right on screen
rois = {}
for key in ('A', 'B'):
    cx, cy = (np.array(CFG['roi'][key]) / 4.0)           # level-2 px
    rad = CFG['roi_diam_um'] / 2 / 1.0                   # 1 um/px
    x0, y0 = int(cx - rad) - 2, int(cy - rad) - 2
    n = int(2 * rad) + 5
    sub_t = tissue[y0:y0 + n, x0:x0 + n]; sub_b = blue[y0:y0 + n, x0:x0 + n]
    yy3, xx3 = np.mgrid[0:n, 0:n]
    disk = (xx3 + x0 - cx) ** 2 + (yy3 + y0 - cy) ** 2 <= rad * rad
    nt = int((sub_t & disk).sum()); nb = int((sub_b & disk).sum())
    # the scan's cumulative count, along the screen's left -> right direction
    proj = ((xx3 + x0 - cx) * u[0] + (yy3 + y0 - cy) * u[1]) / rad          # -1 .. 1 across the circle
    bins = np.linspace(-1, 1, 201)
    hb, _ = np.histogram(proj[sub_b & disk], bins)
    cum = np.concatenate([[0], np.cumsum(hb)]) / max(nt, 1)
    # the counted pixels as an overlay: mint fill + brighter rim, transparent elsewhere
    m = sub_b & disk
    rim = m & ~ndimage.binary_erosion(m, iterations=1)
    ov = np.zeros((n, n, 4), np.uint8)
    ov[m] = [120, 240, 205, 72]
    ov[rim] = [190, 255, 235, 230]
    Image.fromarray(ov, 'RGBA').save(os.path.join(OUT, f'roi{key}.png'), compress_level=6)
    plates_roi = dict(file=f'assets/plates/roi{key}.png', x=float(x0 * 4), y=float(y0 * 4), s=4.0, w=n, h=n)
    rois[key] = dict(center=CFG['roi'][key], diam_um=CFG['roi_diam_um'], tissue_px=nt, blue_px=nb,
                     share=nb / nt, cum=[round(float(v), 5) for v in cum], overlay=plates_roi)
    print(f'ROI {key}: collagen {nb} / tissue {nt} px = {100 * nb / nt:.1f} %')
dAB = float(np.hypot(*(np.array(CFG['roi']['A']) - np.array(CFG['roi']['B'])))) * MPP0
print(f'A-B centre distance {dAB / 1000:.2f} mm, ratio {rois["B"]["share"] / rois["A"]["share"]:.2f}')
glob = float(blue.sum() / tissue.sum())

# ---------------------------------------------------------------- the tissue's long axis (opening dimension line)
L3 = T.pages[PAGES[3]].asarray()[..., :3].astype(np.int16)
m = (L3.min(2) < 190) | (L3.max(2) - L3.min(2) > 40)
m = ndimage.binary_opening(ndimage.binary_closing(m, iterations=4), iterations=2)
lab, n = ndimage.label(m)
big = np.argmax(ndimage.sum(m, lab, range(1, n + 1))) + 1
m = ndimage.binary_fill_holes(lab == big)
ys, xs = np.nonzero(m)
pts = np.c_[xs, ys].astype(np.float64) * 8
c = pts.mean(0); _, _, vt = np.linalg.svd(pts - c, full_matrices=False)
ax, nr = vt[0], vt[1]
if ax[0] < 0: ax = -ax
pr = (pts - c) @ ax; pn = (pts - c) @ nr
tissue_ax = dict(center=c.tolist(), axis=ax.tolist(), normal=nr.tolist(), a0=float(pr.min()), a1=float(pr.max()),
                 n0=float(pn.min()), n1=float(pn.max()), length_um=float((pr.max() - pr.min()) * MPP0),
                 width_um=float((pn.max() - pn.min()) * MPP0))
print(f'tissue {tissue_ax["length_um"] / 1000:.2f} x {tissue_ax["width_um"] / 1000:.2f} mm along its own axes')

L0 = T.pages[PAGES[0]]
mags = {lev: re.search(r'mag=([\d.]+)', T.pages[PAGES[lev]].description).group(1) for lev in PAGES}
json.dump(dict(mpp0=MPP0, scan_w=L0.imagewidth, scan_h=L0.imagelength, slide_mpp=MPP_L,
               slide_rect_world=[(SX0 - lx) * K, (SY0 - ly) * K, (SX1 - lx) * K, (SY1 - ly) * K],
               glass_rgb=WHITE.tolist(), mags=mags,
               slide_reg=dict(centroid_err_um=reg_err, area_ratio=reg_area, origin=[lx, ly], k=K),
               tissue=tissue_ax, rois=rois, ab_dist_um=dAB, collagen_whole=glob, plates=plates),
          open(os.path.join(OUT, 'plates.json'), 'w'), indent=1)
print('ok')
