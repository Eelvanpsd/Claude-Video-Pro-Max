"""Blue Marble plates for the globe: world (4096x2048) and Central Asia, the latter colour-matched to the
2025 Landsat mosaic around the Aral so the inset dissolves into it without a visible patch.
usage: python -I tools/bmng.py <demo_dir>   (after tools/plates.py r2025)"""
import sys, os, json
import numpy as np
from PIL import Image
D = sys.argv[1]
RAW = os.path.join(D, 'assets/raw/gibs'); PL = os.path.join(D, 'assets/plates')
Image.MAX_IMAGE_PIXELS = None
info = json.load(open(os.path.join(PL, 'plates.json')))

w = Image.open(os.path.join(RAW, 'world.jpg')).convert('RGB').resize((4096, 2048), Image.LANCZOS)
ca = np.asarray(Image.open(os.path.join(RAW, 'ca.jpg')).convert('RGB'), np.float32) / 255
CW, CS, CE, CN = 40, 30, 80, 60
H, W = ca.shape[:2]
lon = CW + (np.arange(W) + .5) * (CE - CW) / W; lat = CN - (np.arange(H) + .5) * (CN - CS) / H

# Landsat 2025 resampled onto the ca grid where they overlap
r = info['r2025']; rw, rs, re, rn = r['plate']
ls = np.asarray(Image.open(os.path.join(PL, 'r2025.jpg')).convert('RGB'), np.float32) / 255
lw = np.asarray(Image.open(os.path.join(PL, 'r2025_w.png')), np.float32) / 255
xi = ((lon - rw) / (re - rw) * r['W']).astype(int); yi = ((rn - lat) / (rn - rs) * r['H']).astype(int)
ix = (xi >= 0) & (xi < r['W']); iy = (yi >= 0) & (yi < r['H'])
X, Y = np.meshgrid(np.where(ix)[0], np.where(iy)[0])
sub_ls = ls[yi[Y], xi[X]]; sub_w = lw[yi[Y], xi[X]]; sub_ca = ca[Y, X]
ok = (sub_w < .1) & (sub_ls.sum(-1) > .15) & (sub_ls.max(-1) < .97) & (sub_ca.sum(-1) > .1)
gain = np.ones(3); off = np.zeros(3)
for c in range(3):
    a = sub_ca[..., c][ok]; b = sub_ls[..., c][ok]
    A = np.stack([a, np.ones_like(a)], 1); g, o = np.linalg.lstsq(A, b, rcond=None)[0]
    gain[c], off[c] = g, o
print('ca -> landsat fit gain', gain.round(3), 'offset', off.round(3))
LO, LA = np.meshgrid(lon, lat)
wgt = np.exp(-(((LO - 60) / 9) ** 2 + ((LA - 45) / 7) ** 2))[..., None]
fixed = np.clip(ca * gain + off, 0, 1)
out = ca if '--fit' not in sys.argv else ca * (1 - wgt) + fixed * wgt   # the Landsat scenes are normalised to Blue Marble instead (tools/plates.py)
Image.fromarray((out * 255 + .5).astype(np.uint8)).save(os.path.join(PL, 'ca.jpg'), quality=92)
w.save(os.path.join(PL, 'world.jpg'), quality=92)
info['ca'] = {'plate': [CW, CS, CE, CN], 'W': W, 'H': H, 'source': 'NASA Blue Marble: Next Generation via NASA GIBS', 'colour_fit': [gain.tolist(), off.tolist()]}
info['world'] = {'plate': [-180, -90, 180, 90], 'W': 4096, 'H': 2048, 'source': 'NASA Blue Marble: Next Generation via NASA GIBS'}
json.dump(info, open(os.path.join(PL, 'plates.json'), 'w'), indent=1)
print('wrote world.jpg, ca.jpg')
