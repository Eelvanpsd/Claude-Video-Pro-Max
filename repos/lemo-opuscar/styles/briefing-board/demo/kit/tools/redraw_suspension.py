#!/usr/bin/env python3
"""Redraw the main cables and hangers of a suspension-bridge cut-out as clean lines, at the
positions measured in the cut-out itself. Keyed hangers turn into pale smears once the main span
is stretched; a parabola fitted to each main cable and the measured hanger positions give clean,
honest geometry, while the towers and deck stay the photograph.

    python3 kit/tools/redraw_suspension.py <id> [--color .36,.38,.41 --cable 7 --hanger 4 --ss 3]

Uses meta anchors L / R (tower centres at the water line). Towers stay in front of the cables.
"""
import argparse, json, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
HERE = os.path.dirname(os.path.abspath(__file__)); OBJ = os.path.join(os.path.dirname(HERE), 'objects')
ap = argparse.ArgumentParser(); ap.add_argument('id'); ap.add_argument('--color', default='.36,.38,.41')
ap.add_argument('--cable', type=float, default=7); ap.add_argument('--hanger', type=float, default=4); ap.add_argument('--ss', type=int, default=3)
ap.add_argument('--tower-half', type=int, default=110)
a = ap.parse_args()
img = np.asarray(Image.open(os.path.join(OBJ, a.id + '.png')).convert('RGBA'), np.float32) / 255
meta = json.load(open(os.path.join(OBJ, a.id + '.json'))); H, W = img.shape[:2]
al = img[..., 3]; L = int(meta['anchors']['L'][0] * W); R = int(meta['anchors']['R'][0] * W)
# deck top: first row (from the top) where the main span is mostly solid
# deck top per column: the top of the first long solid band (the stiffening truss), fitted with a line
sm = ndi.gaussian_filter(al, (6, 2)); dx_, dy_ = [], []
for x in range(L + a.tower_half + 20, R - a.tower_half - 20, 10):
    col = sm[:, x] > .5; d = np.diff(np.r_[0, col.astype(np.int8), 0]); s_, e_ = np.where(d == 1)[0], np.where(d == -1)[0]
    band = [(u, v) for u, v in zip(s_, e_) if v - u >= 50]
    if band: dx_.append(x); dy_.append(band[0][0])
dx_, dy_ = np.array(dx_, float), np.array(dy_, float); pd = np.polyfit(dx_, dy_, 1)
for _ in range(3):
    r = np.abs(np.polyval(pd, dx_) - dy_); k_ = r < max(4, 2.5 * np.median(r)); pd = np.polyfit(dx_[k_], dy_[k_], 1)
deck_at = lambda x: float(np.polyval(pd, x)); deck = int(min(deck_at(L), deck_at(R)))
# main cables: in each column of the main span, the topmost thin runs above the deck
xs, ys1, ys2 = [], [], []
for x in range(L + a.tower_half + 10, R - a.tower_half - 10, 6):
    col = al[:int(deck_at(x)) - 8, x] > .35; d = np.diff(np.r_[0, col.astype(np.int8), 0]); s, e = np.where(d == 1)[0], np.where(d == -1)[0]
    runs = [(s_ + e_ - 1) / 2 for s_, e_ in zip(s, e) if e_ - s_ <= 40]
    if runs: xs.append(x); ys1.append(runs[0]); ys2.append(runs[1] if len(runs) > 1 and runs[1] - runs[0] < 45 else np.nan)
xs, ys1, ys2 = np.array(xs, float), np.array(ys1, float), np.array(ys2, float)
def robust_quad(x, y):
    m = np.isfinite(y)
    for _ in range(4):
        p = np.polyfit(x[m], y[m], 2); r = np.abs(np.polyval(p, x) - y); m = m & (r < max(6, 2.5 * np.nanmedian(r[m])))
    return p
p1 = robust_quad(xs, ys1); p2 = robust_quad(xs, ys2) if np.isfinite(ys2).sum() > 30 else None
# side spans: straight-ish cables from the tower tops to the ends, fitted the same way
def side_fit(x0, x1):
    sx, sy = [], []
    for x in range(x0, x1, 6):
        col = al[:deck - 8, x] > .35; d = np.diff(np.r_[0, col.astype(np.int8), 0]); s, e = np.where(d == 1)[0], np.where(d == -1)[0]
        runs = [(s_ + e_ - 1) / 2 for s_, e_ in zip(s, e) if e_ - s_ <= 40]
        if runs: sx.append(x); sy.append(runs[0])
    if len(sx) < 10: return None, (x0, x1)
    sx, sy = np.array(sx, float), np.array(sy, float); return robust_quad(sx, sy), (int(sx.min()), int(sx.max()))
sideL = side_fit(10, L - a.tower_half - 10); sideR = side_fit(R + a.tower_half + 10, W - 10)
# hangers: column coverage between the cable and the deck, peaks = hanger centres
hcov = np.zeros(W)
for x in range(L + a.tower_half + 10, R - a.tower_half - 10):
    yc = int(np.polyval(p1, x)) + 10
    db = int(deck_at(x))
    if db - 6 - yc > 20: hcov[x] = (al[yc:db - 6, x] > .3).mean()
hs = ndi.gaussian_filter1d(hcov, 3); pk = [x for x in range(2, W - 2) if hs[x] > .25 and hs[x] >= hs[x - 1] and hs[x] >= hs[x + 1]]
hang = []
for x in pk:
    if not hang or x - hang[-1] > 18: hang.append(x)
# base: remove every thin part above the deck except the towers
keep = np.zeros(W, bool); keep[max(0, L - a.tower_half):L + a.tower_half] = True; keep[R - a.tower_half:min(W, R + a.tower_half)] = True
base = img.copy()
for x in np.where(~keep)[0]: base[:int(deck_at(min(max(x, L), R))) - 2, x, 3] = 0
# pale, half-transparent leftovers of keyed cables (beside the towers, at the hanger feet) go too
lum = base[..., :3] @ np.array([.2126, .7152, .0722], np.float32)
pale = (lum > .66) & (base[..., 3] < .97)
for x in range(W):
    yd = int(deck_at(min(max(x, L), R)))
    base[:yd + 14, x, 3] = np.where(pale[:yd + 14, x], 0, base[:yd + 14, x, 3])
# draw
ss = a.ss; cv = Image.new('L', (W * ss, H * ss), 0); dr = ImageDraw.Draw(cv)
def poly(p, x0, x1, w):
    pts = [(x * ss, float(np.polyval(p, x)) * ss) for x in np.linspace(x0, x1, 200)]; dr.line(pts, fill=255, width=int(round(w * ss)), joint='curve')
poly(p1, L, R, a.cable)
if p2 is not None: poly(p2, L, R, a.cable * .8)
for (p, (x0, x1)), xe in ((sideL, 0), (sideR, W - 1)):
    if p is not None: poly(p, 0, L, a.cable) if xe == 0 else poly(p, R, W - 1, a.cable)
for x in hang:
    yc = float(np.polyval(p1, x)); dr.line([(x * ss, yc * ss), (x * ss, (deck_at(x) + 2) * ss)], fill=255, width=int(round(a.hanger * ss)))
la = np.asarray(cv.resize((W, H), Image.LANCZOS), np.float32) / 255
col = np.array([float(v) for v in a.color.split(',')], np.float32)
front = (base[..., 3:4] > .5).astype(np.float32); lw = la[..., None] * (1 - front)
rgb = base[..., :3] * (1 - lw) + col * lw
out = np.dstack([np.clip(rgb, 0, 1), np.maximum(base[..., 3], la)])
Image.fromarray((out * 255 + .5).astype(np.uint8), 'RGBA').save(os.path.join(OBJ, a.id + '.png'), optimize=True)
meta['cables_redrawn'] = dict(hangers=len(hang), deck_y=round(deck / H, 4)); json.dump(meta, open(os.path.join(OBJ, a.id + '.json'), 'w'), indent=2)
print(a.id, 'deck row', deck, 'hangers', len(hang), 'second cable', p2 is not None)
