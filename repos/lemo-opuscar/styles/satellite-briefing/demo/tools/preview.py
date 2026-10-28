"""Quick look at a composite plate: true colour (or MSS false colour) + NDWI water mask."""
import sys, json, numpy as np
from PIL import Image
z = np.load(sys.argv[1], allow_pickle=False); meta = json.loads(str(z['meta']))
b = {n: z['bands'][i].astype(np.float32) for i, n in enumerate(meta['bands'])}
if 'blue' in b: rgb = np.stack([b['red'], b['green'], b['blue']], -1)
else: rgb = np.stack([b['red'], b['green'], b['green'] * .8 + b['red'] * .1], -1)
lo, hi = np.percentile(rgb[z['valid']], [1, 99.5]); rgb = np.clip((rgb - lo) / (hi - lo), 0, 1) ** (1 / 1.4)
nir = b.get('nir09', b['nir08']); ndwi = (b['green'] - nir) / (b['green'] + nir + 1e-6)
im = Image.fromarray((rgb * 255).astype(np.uint8)); im.thumbnail((1100, 1100)); im.save(sys.argv[2])
w = Image.fromarray(((ndwi > float(sys.argv[3]) if len(sys.argv) > 3 else ndwi > 0) * 255).astype(np.uint8)); w.thumbnail((1100, 1100)); w.save(sys.argv[2].replace('.jpg', '_w.png'))
print(meta['W'], meta['H'], 'ndwi pct', np.percentile(ndwi[z['valid']], [5, 25, 50, 75, 95]))
