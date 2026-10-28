#!/usr/bin/env python3
"""Repair arch hangers lost against a busy background: every vertical hanger that is clearly visible
just under the arch rib is continued straight down to the deck in its own colour, and stray soft
fragments between the rib and the deck are removed.

    python3 kit/tools/repair_hangers.py <id> --deck 0.615 --band 0.06 [--x0 0.16 --x1 0.92]

--deck: normalised y of the deck top; --band: how far under the rib (normalised) a hanger must be visible.
"""
import argparse, json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
HERE = os.path.dirname(os.path.abspath(__file__)); OBJ = os.path.join(os.path.dirname(HERE), 'objects')
ap = argparse.ArgumentParser(); ap.add_argument('id'); ap.add_argument('--deck', type=float, required=True)
ap.add_argument('--band', type=float, default=.06); ap.add_argument("--maxw", type=int, default=16); ap.add_argument("--minfill", type=float, default=.12); ap.add_argument('--x0', type=float, default=0); ap.add_argument('--x1', type=float, default=1)
a = ap.parse_args()
im = np.asarray(Image.open(os.path.join(OBJ, a.id + '.png')).convert('RGBA'), np.float32) / 255
H, W = im.shape[:2]; al = im[..., 3]; deck = int(a.deck * H); band = int(a.band * H)
solid = al > .6
# rib underside per column: the lowest solid pixel of the first solid run from the top (above the deck)
rib = np.full(W, -1)
for x in range(int(a.x0 * W), int(a.x1 * W)):
    col = np.where(solid[:deck, x])[0]
    if len(col):
        runs = np.split(col, np.where(np.diff(col) > 1)[0] + 1); rib[x] = runs[0][-1]
# a hanger touching the rib would read as part of it: take the rib line from a wide median instead
valid = rib >= 0; rmed = ndi.median_filter(np.where(valid, rib, 0), size=61); rib = np.where(valid, np.minimum(rib, rmed), -1)
# hanger columns: solid in the band just under the rib
hang = np.zeros(W, bool)
for x in np.where(rib >= 0)[0]:
    y0 = rib[x] + 3; y1 = min(deck - 2, y0 + band)
    if y1 - y0 > 4 and solid[y0:y1, x].mean() > .8 and solid[y0:deck - 2, x].mean() > a.minfill: hang[x] = True
lab, n = ndi.label(hang); fixed = 0
out = im.copy()
for i in range(1, n + 1):
    xs = np.where(lab == i)[0]
    if len(xs) > a.maxw or len(xs) < 3: continue                  # too wide (a post, a sign) or a speck: not a hanger
    x0, x1 = xs.min(), xs.max() + 1; y0 = int(np.median(rib[x0:x1])) + 3
    seg = im[y0:y0 + band, x0:x1]; good = seg[..., 3] > .6
    if good.sum() < 3: continue
    colr = np.median(seg[good][:, :3], axis=0)
    for y in range(y0, deck):
        row = out[y, x0:x1]
        if row[:, 3].mean() < .6:                                # missing here: paint the hanger in its own colour
            out[y, x0:x1, :3] = colr; out[y, x0:x1, 3] = 1
    fixed += 1
# clean soft fragments between rib and deck outside hangers and solid structure
mask_keep = np.zeros((H, W), bool)
for i in range(1, n + 1):
    xs = np.where(lab == i)[0]; mask_keep[:, max(0, xs.min() - 1):xs.max() + 2] = True
for x in range(W):
    if rib[x] < 0 or mask_keep[0, x]: continue
    ys = slice(rib[x] + 4, deck - 2); frag = out[ys, x, 3]
    out[ys, x, 3] = np.where(frag < .85, 0, frag)
    low = slice(int(deck - .45 * (deck - rib[x])), deck - 2)          # posts and sign legs in the lower gap go too
    out[low, x, 3] = 0
Image.fromarray((np.clip(out, 0, 1) * 255 + .5).astype(np.uint8), 'RGBA').save(os.path.join(OBJ, a.id + '.png'), optimize=True)
meta = json.load(open(os.path.join(OBJ, a.id + '.json'))); meta['hangers_repaired'] = fixed
json.dump(meta, open(os.path.join(OBJ, a.id + '.json'), 'w'), indent=2)
print(a.id, 'hangers continued to the deck:', fixed)
