# Extract the left half of the Corne Cherry v4.1 PCB + 3x6 switch plate from the KiCad sources
# usage: python -I tools/extract_pcb.py <corne-cherry.kicad_pcb> <plate-top-cherrymx.kicad_pcb> <out.json>
import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sexp import parse, kids, kid
from kicad_geom import *

pcb = parse(open(sys.argv[1]).read())
plate = parse(open(sys.argv[2]).read())
R = lambda v: round(v, 3)

# ---- plate (own file) -> PCB coordinates (plate = pcb + (-0.40, +0.40), measured from 21 cutout centres)
loops, _ = chain(collect(plate)); loops.sort(key=lambda l: -abs(area(l)))
DX, DY = 0.4, -0.4
def sh(l): return [[R(x+DX), R(y+DY)] for x, y in l]
plate_outline = sh(loops[0])
cut, holes = [], []
for l in loops[1:]:
    bx = bbox(l); w = bx[2]-bx[0]
    if w > 10: cut.append(sh(l))
    else: holes.append({'c': [R((bx[0]+bx[2])/2+DX), R((bx[1]+bx[3])/2+DY)], 'r': R(w/2)})
pb = bbox(plate_outline)
def inside_left(x, y): return pb[0]-1 < x < pb[2]+1 and pb[1]-1 < y < pb[3]+1

# ---- PCB board holes (Edge.Cuts circles in the left half)
pcb_holes = []
for p in collect(pcb, with_fp=False):
    if p[0] == 'circle' and inside_left(*p[2]): pcb_holes.append({'c': [R(p[2][0]), R(p[2][1])], 'r': R(p[3])})

def ref_of(f):
    for p in kids(f, 'property'):
        if p[1] == 'Reference': return p[2]
    for t in kids(f, 'fp_text'):
        if t[1] == 'reference': return t[2]
    return '?'
def val_of(f):
    for p in kids(f, 'property'):
        if p[1] == 'Value': return p[2]
    for t in kids(f, 'fp_text'):
        if t[1] == 'value': return t[2]
    return ''

side = lambda layer: 'F' if layer.startswith('F.') else ('B' if layer.startswith('B.') else None)

# ---- tracks, vias
tracks = {'F': [], 'B': []}
for s in kids(pcb, 'segment'):
    a = xy(s, 'start'); b = xy(s, 'end'); L = side(kid(s, 'layer')[1])
    if L and inside_left(*a): tracks[L].append([R(a[0]), R(a[1]), R(b[0]), R(b[1]), R(num(s, 'width'))])
for s in kids(pcb, 'arc'):
    pts = arc3(xy(s, 'start'), xy(s, 'mid'), xy(s, 'end'), 0.3); L = side(kid(s, 'layer')[1]); w = num(s, 'width')
    if L and inside_left(*pts[0]):
        for i in range(len(pts)-1): tracks[L].append([R(pts[i][0]), R(pts[i][1]), R(pts[i+1][0]), R(pts[i+1][1]), R(w)])
vias = []
for v in kids(pcb, 'via'):
    a = xy(v, 'at')
    if inside_left(*a): vias.append([R(a[0]), R(a[1]), R(num(v, 'size')), R(num(v, 'drill'))])

# ---- zones (filled copper)
zones = {'F': [], 'B': []}
for z in kids(pcb, 'zone'):
    for fp in kids(z, 'filled_polygon'):
        L = side(kid(fp, 'layer')[1])
        pts = [(float(p[1]), float(p[2])) for p in kid(fp, 'pts')[1:] if p[0] == 'xy']
        if L and pts and inside_left(*pts[0]) and abs(area(pts)) > 0.5:
            zones[L].append([[R(x), R(y)] for x, y in pts])

# ---- footprints: pads, silk, courtyard bodies
pads, silk, comps, switches = [], {'F': [], 'B': []}, [], []
for f in kids(pcb, 'footprint'):
    at = kid(f, 'at'); fat = (float(at[1]), float(at[2]), float(at[3]) if len(at) > 3 else 0.0)
    if not inside_left(fat[0], fat[1]): continue
    ref = ref_of(f); lib = f[1]; fl = side(kid(f, 'layer')[1])
    if 'logo' in lib or 'Breakaway' in lib: continue   # project logo and panel tabs are not part of the finished board
    for p in kids(f, 'pad'):
        pat = kid(p, 'at'); local = (float(pat[1]), float(pat[2])); prot = float(pat[3]) if len(pat) > 3 else 0.0
        g = xform(fat, local); size = kid(p, 'size'); dr = kid(p, 'drill')
        layers = kid(p, 'layers')[1:]
        lay = 'both' if any(l.startswith('*.Cu') for l in layers) else ('F' if 'F.Cu' in layers else ('B' if 'B.Cu' in layers else None))
        drill = float(dr[1]) if dr and len(dr) > 1 and dr[1] != 'oval' else (float(dr[2]) if dr and len(dr) > 2 else 0)
        pads.append({'x': R(g[0]), 'y': R(g[1]), 'rot': R(prot), 'shape': p[3], 'w': R(float(size[1])), 'h': R(float(size[2])), 'drill': R(drill), 'type': p[2], 'lay': lay})
    for g in f:
        if isinstance(g, list) and g and g[0] in ('fp_line', 'fp_arc', 'fp_circle', 'fp_poly', 'fp_rect'):
            L = kid(g, 'layer')[1]
            if L in ('F.SilkS', 'B.SilkS'):
                pr = prim_poly(g, L, fat); st = kid(g, 'stroke'); w = float(kid(st, 'width')[1]) if st else (num(g, 'width') or 0.15)
                if pr:
                    pts = pr[1] + ([pr[1][0]] if pr[0] in ('circle', 'closed') else [])
                    silk[L[0]].append({'pts': [[R(x), R(y)] for x, y in pts], 'w': R(w), 'fill': g[0] == 'fp_poly'})
    # courtyard bbox in local coords -> body footprint
    cy = []
    for g in f:
        if isinstance(g, list) and g and g[0].startswith('fp_') and kid(g, 'layer') and kid(g, 'layer')[1] in ('F.CrtYd', 'B.CrtYd', 'F.Fab', 'B.Fab'):
            for k in ('start', 'end', 'center', 'mid'):
                v = xy(g, k)
                if v: cy.append(v)
            if kid(g, 'pts'): cy += [(float(p[1]), float(p[2])) for p in kid(g, 'pts')[1:] if p[0] == 'xy']
    lb = [R(min(p[0] for p in cy)), R(min(p[1] for p in cy)), R(max(p[0] for p in cy)), R(max(p[1] for p in cy))] if cy else None
    rec = {'ref': ref, 'lib': lib.split(':')[-1], 'val': val_of(f), 'x': R(fat[0]), 'y': R(fat[1]), 'rot': R(fat[2]), 'side': fl, 'lbox': lb}
    if ref.startswith('SW') and 'keyswitch' in lib:
        rec['u'] = 1.5 if '1.5u' in lib else 1.0; switches.append(rec)
    else: comps.append(rec)

out = {
  'source': 'foostan/crkbd @ 63366fb, pcbs/corne-cherry/hotswap/corne-cherry.kicad_pcb (rev 4.1.0) + plates/3x6/pcb/plate-top-cherrymx.kicad_pcb',
  'license': 'CC BY 4.0 (LICENSE_CC) / MIT (LICENSE_MIT), (c) foostan',
  'pcb_thickness': 1.6,
  'plate': {'outline': plate_outline, 'cutouts': cut, 'holes': holes},
  'pcb_holes': pcb_holes, 'switches': switches, 'comps': comps, 'pads': pads,
  'tracks': tracks, 'vias': vias, 'zones': zones, 'silk': silk,
}
json.dump(out, open(sys.argv[3], 'w'), separators=(',', ':'))
print('plate cutouts', len(cut), 'plate holes', holes, 'pcb holes', pcb_holes)
print('switches', len(switches), 'comps', len(comps), 'pads', len(pads), 'tracks F/B', len(tracks['F']), len(tracks['B']), 'vias', len(vias), 'zones F/B', len(zones['F']), len(zones['B']), 'silk', len(silk['F']), len(silk['B']))
import collections; print(collections.Counter(c['lib'] for c in comps))
