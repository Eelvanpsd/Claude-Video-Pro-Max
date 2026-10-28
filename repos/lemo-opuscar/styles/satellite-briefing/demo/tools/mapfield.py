"""The map layer (the claim): a printed-atlas Aral Sea built from public-domain Natural Earth data.

  assets/plates/mapfield.png   R = distance inside the 1960 shore (0..60 km), G = distance outside it (0..60 km),
                               B = relief (Blue Marble luminance, for a faint hill-shade on the paper)
  assets/vectors.json          adds "rivers" (Amu Darya, Syr Darya near the sea) for the map's blue river lines

The shader draws paper, sea fill, waterlines and the coast from the distance field (exact at any zoom),
the overlay draws rivers and the map's serif place names.
usage: python -I tools/mapfield.py <demo_dir>"""
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

D = sys.argv[1]
W0, S0, E0, N0, STEP = 54.0, 41.5, 66.0, 48.5, 0.01
W, H = int(round((E0 - W0) / STEP)), int(round((N0 - S0) / STEP))
lat0 = 45.0
kx = 111.32 * np.cos(np.radians(lat0)) * STEP; ky = 110.57 * STEP     # km per pixel

ne = json.load(open(os.path.join(D, 'assets/raw/ne/ne_10m_lakes_historic.geojson')))
im = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(im)
for f in ne['features']:
    if f['properties'].get('name') != 'Aral Sea': continue
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in polys:
        for k, ring in enumerate(poly):
            dr.polygon([((x - W0) / STEP, (N0 - y) / STEP) for x, y in ring], fill=255 if k == 0 else 0)
sea = np.asarray(im) > 0
din = ndimage.distance_transform_edt(sea, sampling=(ky, kx))
dout = ndimage.distance_transform_edt(~sea, sampling=(ky, kx))
# relief from Blue Marble (Central Asia plate covers 40-80E, 30-60N)
ca = np.asarray(Image.open(os.path.join(D, 'assets/raw/gibs/ca.jpg')).convert('L'), np.float32) / 255
lon = W0 + (np.arange(W) + .5) * STEP; lat = N0 - (np.arange(H) + .5) * STEP
xi = ((lon - 40) / 40 * ca.shape[1]).astype(int); yi = ((60 - lat) / 30 * ca.shape[0]).astype(int)
rel = ca[yi[:, None], xi[None, :]]
rel = ndimage.gaussian_filter(rel, 1.5)
rel = np.clip((rel - np.percentile(rel, 2)) / (np.percentile(rel, 98) - np.percentile(rel, 2)), 0, 1)
rgb = np.stack([np.clip(din / 60, 0, 1), np.clip(dout / 60, 0, 1), rel], -1)
Image.fromarray((rgb * 255 + .5).astype(np.uint8)).save(os.path.join(D, 'assets/plates/mapfield.png'))
info = json.load(open(os.path.join(D, 'assets/plates/plates.json')))
info['mapfield'] = {'plate': [W0, S0, E0, N0], 'W': W, 'H': H, 'km': 60, 'source': 'Natural Earth ne_10m_lakes_historic; Blue Marble relief'}
json.dump(info, open(os.path.join(D, 'assets/plates/plates.json'), 'w'), indent=1)

# rivers near the sea
rv = json.load(open(os.path.join(D, 'assets/raw/ne/ne_10m_rivers_lake_centerlines.geojson')))
out = {}
for f in rv['features']:
    n = (f['properties'].get('name') or '').replace('  ', ' ')
    if n not in ('Amu Darya', 'Syr Darya'): continue
    g = f['geometry']; lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
    for L in lines:
        L = [[round(x, 4), round(y, 4)] for x, y in L if 56 <= x <= 66 and 41.5 <= y <= 48]
        if len(L) > 1: out.setdefault(n, []).append(L)
V = json.load(open(os.path.join(D, 'assets/vectors.json')))
V['rivers'] = out
json.dump(V, open(os.path.join(D, 'assets/vectors.json'), 'w'), separators=(',', ':'))
print('mapfield', W, H, 'sea px', int(sea.sum()), 'rivers', {k: sum(len(l) for l in v) for k, v in out.items()})
