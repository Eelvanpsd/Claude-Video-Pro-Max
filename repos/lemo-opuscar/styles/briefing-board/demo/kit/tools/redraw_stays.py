#!/usr/bin/env python3
"""Redraw the stay cables of a cable-stayed bridge cut-out as clean anti-aliased lines, at the
positions measured in the photo. The photographed stays (twin strands, helical fillets) turn into
stair-steps and dashes when keyed and scaled; their geometry is simple and exact, so it is measured
from the sky key and drawn again.

    python3 kit/tools/redraw_stays.py <id> --key sources/masks/cable_sky.png --pylon 4681 --deck-y 2174 \
        --scan-deck 2110 --scan-left 4520 --scan-right 4850 [--width 7 --color .62,.64,.66]

All coordinates are in the cropped photo (the key's) pixels; the object's meta 'trim' maps them.
For each fan: the crossings of a horizontal scan just above the deck and of a vertical scan beside
the pylon are found, paired in order (outermost deck point ↔ topmost pylon point) by a monotone
match that maximises the key along each candidate line, and every pair is drawn from the deck to
the pylon centre line. The pylon and deck from the base cut-out stay in front of the cables.
"""
import argparse, json, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
HERE = os.path.dirname(os.path.abspath(__file__)); OBJ = os.path.join(os.path.dirname(HERE), 'objects')
ap = argparse.ArgumentParser(); ap.add_argument('id'); ap.add_argument('--key', required=True)
for k in ('pylon', 'deck_y', 'scan_deck', 'scan_left', 'scan_right'): ap.add_argument('--' + k.replace('_', '-'), dest=k, type=float, required=True)
ap.add_argument('--keep-poly'); ap.add_argument('--width', type=float, default=7); ap.add_argument('--color', default='.62,.64,.66'); ap.add_argument('--ss', type=int, default=3)
a = ap.parse_args()
img = np.asarray(Image.open(os.path.join(OBJ, a.id + '.png')).convert('RGBA'), np.float32) / 255
meta = json.load(open(os.path.join(OBJ, a.id + '.json'))); tx, ty = meta['trim'][0], meta['trim'][1]
key = np.asarray(Image.open(a.key).convert('L'), np.float32) / 255
H, W = img.shape[:2]
if a.keep_poly:   # above the deck, only the pylon survives from the base cut (no stray cable fragments)
    pm = Image.new('L', (W, H), 0)
    ImageDraw.Draw(pm).polygon([(float(q.split(',')[0]) - tx, float(q.split(',')[1]) - ty) for q in a.keep_poly.split()], fill=255)
    keep = np.asarray(pm, np.float32) / 255; above = (np.arange(H)[:, None] < a.deck_y - 30 - ty)
    img[..., 3] = np.where(above & (keep < .5), 0, img[..., 3])

def centres(v, thr=.45, minw=2):
    m = v > thr; d = np.diff(np.r_[0, m.astype(np.int8), 0]); s, e = np.where(d == 1)[0], np.where(d == -1)[0]
    return [(s_ + e_ - 1) / 2 for s_, e_ in zip(s, e) if e_ - s_ >= minw]
KEYMAX = ndi.maximum_filter(key, 3)
def line_score(p, q, n=160):
    xs = np.linspace(p[0], q[0], n); ys = np.linspace(p[1], q[1], n)
    return float(ndi.map_coordinates(KEYMAX, [ys, xs], order=1).mean())
def match(deck_pts, pyl_pts):
    """monotone matching maximising the key along each line (outer deck ↔ top pylon)"""
    n, m = len(deck_pts), len(pyl_pts); S = np.full((n + 1, m + 1), -1e9); S[0, :] = 0; S[:, 0] = 0; B = {}
    sc = np.array([[line_score(deck_pts[i], pyl_pts[j]) for j in range(m)] for i in range(n)])
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            opts = [(S[i - 1, j], 'i'), (S[i, j - 1], 'j')]
            if sc[i - 1, j - 1] > .55: opts.append((S[i - 1, j - 1] + sc[i - 1, j - 1], 'd'))
            S[i, j], B[i, j] = max(opts)
    i, j, pairs = n, m, []
    while i > 0 and j > 0:
        b = B[i, j]
        if b == 'd': pairs.append((deck_pts[i - 1], pyl_pts[j - 1], sc[i - 1, j - 1])); i -= 1; j -= 1
        elif b == 'i': i -= 1
        else: j -= 1
    return pairs[::-1]

lines = []
for side in ('left', 'right'):
    if side == 'left':
        xs = [x for x in centres(key[int(a.scan_deck), :int(a.pylon) - 300])]; dpts = [(x, a.scan_deck) for x in sorted(xs)]
        ys = centres(key[:int(a.deck_y) - 200, int(a.scan_left)]); ppts = [(a.scan_left, y) for y in sorted(ys)]
    else:
        xs = [x for x in centres(key[int(a.scan_deck), int(a.pylon) + 300:])]; dpts = [(x + int(a.pylon) + 300, a.scan_deck) for x in sorted(xs, reverse=True)]
        ys = centres(key[:int(a.deck_y) - 200, int(a.scan_right)]); ppts = [(a.scan_right, y) for y in sorted(ys)]
    for p, q, s in match(dpts, ppts):
        # extend from the deck surface to the pylon centre line
        dx, dy = q[0] - p[0], q[1] - p[1]
        t0 = (a.deck_y - p[1]) / dy if dy else 0; t1 = (a.pylon - p[0]) / dx if dx else 1
        P0 = (p[0] + dx * t0, p[1] + dy * t0); P1 = (p[0] + dx * t1, p[1] + dy * t1)
        lines.append((P0, P1, s))
    print(side, 'deck crossings', len(dpts), 'pylon crossings', len(ppts), '→ stays', sum(1 for l in lines if (l[0][0] < a.pylon) == (side == 'left')))
# draw at ss× and downsample for anti-aliasing, in object coordinates
ss = a.ss; cv = Image.new('L', (W * ss, H * ss), 0); dr = ImageDraw.Draw(cv)
for P0, P1, s in lines:
    dr.line([((P0[0] - tx) * ss, (P0[1] - ty) * ss), ((P1[0] - tx) * ss, (P1[1] - ty) * ss)], fill=255, width=int(round(a.width * ss)))
la = np.asarray(cv.resize((W, H), Image.LANCZOS), np.float32) / 255
col = np.array([float(v) for v in a.color.split(',')], np.float32)
base_a = img[..., 3:4]; front = (base_a > .5).astype(np.float32)          # pylon and deck stay in front
lw = la[..., None] * (1 - front)
rgb = img[..., :3] * (1 - lw) + col * lw
# a lighter core makes a round cable read on the board
core = np.asarray(Image.fromarray((la * 255).astype(np.uint8)).filter(__import__('PIL.ImageFilter', fromlist=['x']).MinFilter(3)), np.float32)[..., None] / 255
rgb = rgb + (1 - front) * core * .12
alpha = np.maximum(img[..., 3], la)
out = np.dstack([np.clip(rgb, 0, 1), alpha])
Image.fromarray((out * 255 + .5).astype(np.uint8), 'RGBA').save(os.path.join(OBJ, a.id + '.png'), optimize=True)
meta['stays_redrawn'] = len(lines); json.dump(meta, open(os.path.join(OBJ, a.id + '.json'), 'w'), indent=2)
print(a.id, 'stays drawn:', len(lines))
