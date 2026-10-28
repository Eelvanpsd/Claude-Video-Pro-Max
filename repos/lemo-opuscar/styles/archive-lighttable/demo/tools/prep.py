"""Textures for the page, from the archive scans in assets/raw/ (see CREDITS).
usage: python -I tools/prep.py <demo_dir>

  p1.jpg, p1_mask.png          first flight plate (LoC ppprs.00626), positive scan + emulsion mask
  p1_bg.jpg                    the same plate with the Flyer and Wilbur removed and the hole filled (push-pull),
  p1_fly.png, p1_wil.png       ... and the two cut-out layers (grey + alpha), full resolution, cropped to a box;
                               their boxes are written to assets/tex/layers.json
  p2.jpg, p2_mask.png          fourth flight, distant view (LoC ppprs.00629)
  p3.jpg, p3_mask.png          14 December, the failed trial (LoC ppprs.00610), half resolution (a prop)
  tg.jpg                       telegram (LoC mcc.061 via Wikimedia Commons), scan mat trimmed
  news.jpg                     Dayton Herald, 18 Dec 1903 (LoC cph.3b18080)
"""
import sys, os, json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
Image.MAX_IMAGE_PIXELS = None

D = sys.argv[1]
RAW = os.path.join(D, 'assets', 'raw'); OUT = os.path.join(D, 'assets', 'tex')
os.makedirs(OUT, exist_ok=True)


def emulsion_mask(img, s=4):
    """near-white pixels connected to the scan border = scanner margin or missing glass"""
    W, H = img.size
    small = np.asarray(img.resize((W // s, H // s), Image.BILINEAR)).astype(np.float32)
    white = small > 228
    white[:3, :] = white[-3:, :] = True; white[:, :3] = white[:, -3:] = True
    lab, _ = ndi.label(white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(border))
    m = Image.fromarray(np.where(outside, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    return m


def pushpull(val, known):
    """fill unknown pixels from a pyramid of known ones (smooth membrane fill)"""
    if min(val.shape) < 4 or known.all():
        filled = val.copy()
        if not known.all():
            filled[~known] = val[known].mean() if known.any() else 0.5
        return filled
    v2 = val.reshape(val.shape[0] // 2, 2, val.shape[1] // 2, 2) if val.shape[0] % 2 == 0 and val.shape[1] % 2 == 0 else None
    h, w = val.shape
    h2, w2 = (h + 1) // 2, (w + 1) // 2
    pv = np.zeros((h2 * 2, w2 * 2), np.float64); pk = np.zeros((h2 * 2, w2 * 2), np.float64)
    pv[:h, :w] = val * known; pk[:h, :w] = known
    sv = pv.reshape(h2, 2, w2, 2).sum((1, 3)); sk = pk.reshape(h2, 2, w2, 2).sum((1, 3))
    cv = np.where(sk > 0, sv / np.maximum(sk, 1e-9), 0); ck = sk > 0
    coarse = pushpull(cv, ck)
    up = np.asarray(Image.fromarray(coarse.astype(np.float32)).resize((w2 * 2, h2 * 2), Image.BILINEAR))[:h, :w]
    out = val.copy(); out[~known] = up[~known]
    return out


def save_gray(arr, path, q=93):
    Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8)).save(path, quality=q, subsampling=0)


# ---------------- plate 1: first flight ----------------
p1 = Image.open(os.path.join(RAW, 'loc_ppprs00626u.tif')).convert('L')
p1.save(os.path.join(OUT, 'p1.jpg'), quality=93, subsampling=0)
emulsion_mask(p1).save(os.path.join(OUT, 'p1_mask.png'))
A = np.asarray(p1).astype(np.float64) / 255
H, W = A.shape
rng = np.random.default_rng(7)


HZ = 1540                                                             # horizon row
def soft(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

# Difference matting. In the sky a clean background b is known (a smooth membrane under the hazy sky), so every
# pixel inside the Flyer's wing hull splits exactly into b and a layer of black (struts, wires, Orville) or white
# (fabric) with an alpha: composite == original. On the sand below the horizon only strong marks are cut (the
# lower wing, skids, struts) so the ground texture stays on the ground.
fx0, fy0, fx1, fy1 = 1560, 1100, 4120, 1800
sub = A[fy0:fy1, fx0:fx1]
ys = np.arange(fy0, fy1)[:, None] * np.ones((1, fx1 - fx0))
xs = np.arange(fx0, fx1)[None, :] * np.ones((fy1 - fy0, 1))
big = ndi.median_filter(A[fy0 - 200:fy1 + 200:4, fx0 - 300:fx1 + 300:4], size=31)
strong0 = np.abs(sub - np.asarray(Image.fromarray(big.astype(np.float32)).resize((fx1 - fx0 + 600, fy1 - fy0 + 400), Image.BILINEAR))[200:-200, 300:-300]) > 0.06
rows = np.median(np.concatenate([A[fy0:fy1, 900:1500], A[fy0:fy1, 4560:4900]], 1), 1)[:, None]   # sand/sky profile per row, outside the machine
dg = sub - rows
strong0 = ndi.binary_dilation(strong0 | (dg > 0.08) | (dg < -0.075), iterations=12)
b = ndi.gaussian_filter(pushpull(sub, ~strong0), 18)
d = sub - b
# hull: the quadrilateral around both wings (upper tip ~(1640,1290) .. (4040,1170), lower ~(1640,1760) .. (4060,1600))
def hull(x, y):
    top = 1205 + (1085 - 1205) * (x - 1590) / (4100 - 1590)
    bot = 1800 + (1640 - 1800) * (x - 1590) / (4100 - 1590)
    return soft(np.minimum(x - 1585, 4105 - x), 0, 25) * soft(y - top, 0, 25) * soft(bot + 40 - y, 0, 25)
hl = hull(xs, ys)
a_dark = np.clip(-d / np.maximum(b, 0.05), 0, 1); a_lit = np.clip(d / np.maximum(1 - b, 0.05), 0, 1)
a_sky = np.where(d < 0, a_dark, a_lit); c_sky = np.where(d < 0, 0.0, 1.0)
vline = ndi.gaussian_filter(dg, (10, 1.0)) < -0.03                         # thin near-vertical struts and wires
strong = (dg > 0.08) | (dg < -0.075) | vline
strong = ndi.binary_closing(strong, iterations=3)
lab, n = ndi.label(strong); sizes = ndi.sum(strong, lab, range(1, n + 1))
strong = np.isin(lab, [k + 1 for k, sz in enumerate(sizes) if sz > 80])
a_gnd = ndi.gaussian_filter(ndi.binary_dilation(strong, iterations=2).astype(np.float64), 1.0)
wsky = 1 - soft(ys, HZ - 12, HZ + 12)
alpha = hl * (wsky * a_sky + (1 - wsky) * a_gnd)
color = wsky * c_sky + (1 - wsky) * sub
prem = color * alpha
# background: in the sky exactly the membrane b (composite == original), with grain only where the layer is opaque
# (that part is never seen at rest); on the sand the original with the cut-out marks filled
g = ndi.gaussian_filter(rng.normal(0, 1, A.shape), 0.7); g *= 0.016 / g.std()
gs = g[fy0:fy1, fx0:fx1]
gnd_hole = a_gnd > 0.02
gnd_fill = np.where(gnd_hole, pushpull(sub, ~gnd_hole) + gs, sub)
bg_sky = b + gs * soft(alpha, 0.3, 0.7)
bgsub = wsky * bg_sky + (1 - wsky) * gnd_fill
bg = A.copy()
bg[fy0:fy1, fx0:fx1] = hl * bgsub + (1 - hl) * sub
la = np.stack([np.clip(prem * 255 + .5, 0, 255), np.clip(alpha * 255 + .5, 0, 255)], -1).astype(np.uint8)
Image.fromarray(la, 'LA').save(os.path.join(OUT, 'p1_fly.png'))
print('flyer alpha mean in hull', float(alpha[hl > .5].mean()))

# Wilbur: dark suit against light sand / sky; strong cut with holes filled
wx0, wy0, wx1, wy1 = 4260, 1440, 4540, 1915
ws = A[wy0:wy1, wx0:wx1]
wb = ndi.gaussian_filter(pushpull(ws, ws > 0.5), 20)
wm = ndi.binary_fill_holes(ndi.binary_closing((wb - ws) > 0.12, iterations=3))
lab, n = ndi.label(wm); sizes = ndi.sum(wm, lab, range(1, n + 1)); wm = lab == (1 + int(np.argmax(sizes)))
wa = ndi.gaussian_filter(ndi.binary_dilation(wm, iterations=3).astype(np.float64), 1.2)
la = np.stack([np.clip(ws * wa * 255 + .5, 0, 255), np.clip(wa * 255 + .5, 0, 255)], -1).astype(np.uint8)
Image.fromarray(la, 'LA').save(os.path.join(OUT, 'p1_wil.png'))
wh = np.zeros_like(A, bool); wh[wy0:wy1, wx0:wx1] = ndi.binary_dilation(wm, iterations=8)
bg = np.where(wh, pushpull(bg, ~wh) + g, bg)
print('wilbur px', int(wm.sum()))
save_gray(bg, os.path.join(OUT, 'p1_bg.jpg'))
json.dump({'fly': [fx0, fy0, fx1, fy1], 'wil': [wx0, wy0, wx1, wy1], 'horizon': HZ}, open(os.path.join(OUT, 'layers.json'), 'w'))

# ---------------- plate 2: fourth flight; plate 3: 14 December ----------------
p2 = Image.open(os.path.join(RAW, 'loc_ppprs00629u.tif')).convert('L')
p2.save(os.path.join(OUT, 'p2.jpg'), quality=93, subsampling=0); emulsion_mask(p2).save(os.path.join(OUT, 'p2_mask.png'))
p3 = Image.open(os.path.join(RAW, 'loc_ppprs00610u.tif')).convert('L')
p3h = p3.resize((p3.size[0] // 2, p3.size[1] // 2), Image.LANCZOS)
p3h.save(os.path.join(OUT, 'p3.jpg'), quality=90); emulsion_mask(p3h, 2).save(os.path.join(OUT, 'p3_mask.png'))

# ---------------- paper ----------------
tg = Image.open(os.path.join(RAW, 'telegram_mcc061.jpg')).convert('RGB').crop((43, 33, 3560, 2306))
tg.save(os.path.join(OUT, 'tg.jpg'), quality=91)
nw = Image.open(os.path.join(RAW, 'loc_cph3b18080u.tif')).convert('L')
nw.save(os.path.join(OUT, 'news.jpg'), quality=92)
print('sizes', p1.size, p2.size, p3h.size, tg.size, nw.size)
