"""Raw 3DBAG (LOD1.3 parts) + BGT water and bridge decks -> data/model.json, data/water.png, data/stats.json
usage: python -I tools/prep.py <demo_dir>
Model frame: 1:1000 table model, 1 unit = 1 m of model = 1 km of city. x = east, z = south, y = up.
Every number the film shows is computed here and written to data/stats.json (the page only reads it)."""
import json, sys, os, glob, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rd import to_rd, to_wgs
from sun import solar

D = sys.argv[1]
R = os.path.join(D, 'assets/raw')
X0, X1, Y0, Y1 = 91700, 94000, 435300, 437900          # RD crop (m): 2.3 x 2.6 km
CX, CY = (X0 + X1) / 2, (Y0 + Y1) / 2
S = 1 / 1000
BANDS = [(0, 1940), (1940, 1965), (1965, 1990), (1990, 2010), (2010, 2100)]   # pre-war + four post-war layers

feats = json.load(open(os.path.join(R, 'l13_0.json')))['features']
inside = lambda ring: all(X0 <= x <= X1 and Y0 <= y <= Y1 for x, y, *_ in ring)
def area(r): return abs(sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1)) / 2)
def ring_c(r): n = len(r) - 1; return (sum(q[0] for q in r[:-1]) / n, sum(q[1] for q in r[:-1]) / n)
loc = lambda x, y: [round((x - CX) * S, 5), round(-(y - CY) * S, 5)]

B, parts, skipped = {}, [], 0
for f in feats:
    p, g = f['properties'], f['geometry']
    if p.get('b3_h_70p') is None or p.get('b3_h_maaiveld') is None: skipped += 1; continue
    h = p['b3_h_70p'] - p['b3_h_maaiveld']
    if h < 1.5 or h > 260: skipped += 1; continue
    for poly in ([g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']):
        if not inside(poly[0]): continue
        bid = p['identificatie']
        b = B.setdefault(bid, {'id': bid, 'year': p.get('oorspronkelijkbouwjaar') or 0, 'h': 0, 'a': 0, 'polys': []})
        if h > b['h']: b['top'] = ring_c(poly[0])
        b['h'] = max(b['h'], h); b['a'] += area(poly[0]); b['polys'].append((h, poly))
        parts.append((bid, h, poly))

blist = sorted(B.values(), key=lambda b: b['id'])
idx = {b['id']: i for i, b in enumerate(blist)}

# bridge decks (BGT overbruggingsdeel), clipped to the crop: low white slabs across the water
def clip(poly):
    def cl(pts, inside_, inter):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            if inside_(b):
                if not inside_(a): out.append(inter(a, b))
                out.append(b)
            elif inside_(a): out.append(inter(a, b))
        return out
    pts = [tuple(q[:2]) for q in poly[:-1]]
    for axis, lim, keep_ge in ((0, X0, True), (0, X1, False), (1, Y0, True), (1, Y1, False)):
        if not pts: break
        ins = (lambda q, a=axis, l=lim, g=keep_ge: q[a] >= l if g else q[a] <= l)
        def inter(a, b, ax=axis, l=lim):
            t = (l - a[ax]) / (b[ax] - a[ax]); return (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
        pts = cl(pts, ins, inter)
    return pts
decks = []
for f in json.load(open(os.path.join(R, 'overbruggingsdeel.json')))['features']:
    if f['properties'].get('eind_registratie') is not None: continue
    g = f['geometry']
    for poly in ([g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']):
        c = clip(poly[0])
        if len(c) >= 3 and area(c + [c[0]]) > 20: decks.append([loc(x, y) for x, y in c])

out = {'scale': S, 'crop': [X0, X1, Y0, Y1], 'size': [(X1 - X0) * S, (Y1 - Y0) * S], 'bands': BANDS,
       'b': [[b['year'], round(b['h'], 1)] for b in blist],
       'p': [[idx[bid], round(h * S, 5), [[loc(x, y) for x, y, *_ in r[:-1]] for r in poly]] for bid, h, poly in parts],
       'decks': decks}
json.dump(out, open(os.path.join(D, 'data/model.json'), 'w'), separators=(',', ':'))

# ------------------------------------------------------------------ water mask (BGT waterdeel, current records)
MW = 4096; MH = round(MW * (Y1 - Y0) / (X1 - X0))
im = Image.new('L', (MW, MH), 0); d = ImageDraw.Draw(im)
P = lambda r: [((x - X0) / (X1 - X0) * MW, (Y1 - y) / (Y1 - Y0) * MH) for x, y, *_ in r]
for w in json.load(open(os.path.join(R, 'waterdeel.json')))['features']:
    if w['properties']['eind_registratie'] is not None: continue
    g = w['geometry']
    for poly in ([g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']):
        d.polygon(P(poly[0]), fill=255)
        for hole in poly[1:]: d.polygon(P(hole), fill=0)
im.filter(ImageFilter.GaussianBlur(1.2)).save(os.path.join(D, 'data/water.png'))

# ------------------------------------------------------------------ stats
def pos(b): return loc(*b['top']) + [round(b['h'] * S, 5)]
yrs = [b for b in blist if b['year'] > 1200]
tot_a = sum(b['a'] for b in yrs)
bands = []
for lo, hi in BANDS:
    m = [b for b in yrs if lo <= b['year'] < hi]
    bands.append({'lo': lo, 'hi': hi, 'n': len(m), 'area_share': round(sum(b['a'] for b in m) / tot_a, 4),
                  'mean_h': round(sum(b['h'] for b in m) / max(len(m), 1), 1), 'over100': sum(1 for b in m if b['h'] > 100)})
tall = sorted(blist, key=lambda b: -b['h'])
def near_rd(x, y, r=60):
    c = [b for b in blist if (b['top'][0] - x) ** 2 + (b['top'][1] - y) ** 2 < r * r]
    return max(c, key=lambda b: b['a']) if c else None
marks = {}
for name, (x, y) in {'laurens': (92970, 437394), 'stadhuis': to_rd(4.4796, 51.9227), 'zalmhaven': tall[0]['top']}.items():   # Zalmhaven I = the tallest roof (NL.IMBAG.Pand.0599100100020122)
    b = tall[0] if name == 'zalmhaven' else near_rd(x, y); marks[name] = {'id': b['id'], 'year': b['year'], 'h': round(b['h'], 1), 'pos': pos(b), 'bi': idx[b['id']]}

# ------------------------------------------------------------------ winter-solstice noon shadow on a 2 m height grid
lon_c, lat_c = to_wgs(CX, CY)
sun = []
for m in range(8 * 60 + 30, 16 * 60 + 31, 5):
    alt, az = solar(2025, 12, 21, (m - 60) / 60, lat_c, lon_c); sun.append([m, round(alt, 3), round(az, 3)])
noon = max(sun, key=lambda s: s[1])
G = 2.0; GW, GH = int((X1 - X0) / G), int((Y1 - Y0) / G)
def hmap(polys):
    img = Image.new('F', (GW, GH), 0.); dr = ImageDraw.Draw(img)
    for h, poly in sorted(polys, key=lambda q: q[0]):
        dr.polygon([((x - X0) / G, (Y1 - y) / G) for x, y, *_ in poly[0]], fill=float(h))
    return np.array(img)
Hall = hmap([(h, poly) for _, h, poly in parts])
zb = B[marks['zalmhaven']['id']]
Hz = hmap(zb['polys'])
alt, az = math.radians(noon[1]), math.radians(noon[2])
dx, dy = math.sin(az), -math.cos(az)          # toward the sun in grid (col, row): east = +col, north = -row
def shadow_by(src, maxlen=1200):
    sh = np.zeros_like(Hall, bool); tan = math.tan(alt)
    for k in range(1, int(maxlen / G)):
        ox, oy = int(round(k * dx)), int(round(k * dy))
        s = np.zeros_like(src)
        ys0, ys1 = max(0, -oy), min(GH, GH - oy); xs0, xs1 = max(0, -ox), min(GW, GW - ox)
        s[ys0:ys1, xs0:xs1] = src[ys0 + oy:ys1 + oy, xs0 + ox:xs1 + ox]
        sh |= s - k * G * tan > Hall + .5
    return sh
Sz = shadow_by(Hz)
Image.fromarray(((Sz & ~(Hz > 0)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)).save(os.path.join(D, 'data/zshadow.png'))   # the tower's noon shadow, 2 m grid
mine = Hz > 0
shaded = []
for b in blist:
    if b['id'] == zb['id']: continue
    cx, cy = b['top']; c, r = int((cx - X0) / G), int((Y1 - cy) / G)
    if 0 <= r < GH and 0 <= c < GW and Sz[r, c] and not mine[r, c]: shaded.append(b)
ys, xs = np.nonzero(Sz & ~mine)
reach = float(np.max(np.hypot((xs * G + X0) - zb['top'][0], (Y1 - ys * G) - zb['top'][1]))) if len(xs) else 0
stats = {
    'buildings': len(blist), 'parts': len(parts), 'decks': len(decks), 'skipped_parts': skipped, 'year_unknown': len(blist) - len(yrs),
    'bands': bands, 'pre1940_area_share': bands[0]['area_share'],
    'over100': sum(1 for b in blist if b['h'] > 100),
    'tallest': [{'id': b['id'], 'h': round(b['h'], 1), 'year': b['year'], 'pos': pos(b)} for b in tall[:8]],
    'marks': marks, 'centre_wgs': [round(lon_c, 5), round(lat_c, 5)],
    'sun': sun, 'sun_noon': {'min': noon[0], 'alt': noon[1], 'az': noon[2]},
    'zalm_shadow': {'theory_m': round(zb['h'] / math.tan(alt), 1), 'reach_m': round(reach, 1), 'shaded_roofs': len(shaded),
                    'shaded_pre1940': sum(1 for b in shaded if 0 < b['year'] < 1940),
                    'shaded': sorted([{'bi': idx[b['id']], 'year': b['year'], 'h': round(b['h'], 1), 'pos': pos(b),
                                       'd': round(math.hypot(b['top'][0] - zb['top'][0], b['top'][1] - zb['top'][1]), 1)} for b in shaded], key=lambda q: q['d'])},
}
json.dump(stats, open(os.path.join(D, 'data/stats.json'), 'w'), indent=1, ensure_ascii=False)
print(json.dumps({k: v for k, v in stats.items() if k not in ('sun', 'tallest', 'zalm_shadow')} | {'tallest': [(t['h'], t['year']) for t in stats['tallest']]}, ensure_ascii=False, indent=0)[:3000])
