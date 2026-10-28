#!/usr/bin/env python3
"""Stretch the main span of a bridge cut-out horizontally, leaving the towers and side spans
untouched, so a photographed bridge can stand for a longer span of the same type at true scale.

    python3 kit/tools/stretch_span.py <id> <out_id> --from 0.20 --to 0.91 --k 1.7

--from / --to: normalised x range to stretch (between the inner faces of the two towers).
Anchors are moved with the pixels; the meta records the stretch (CREDITS says so too).
"""
import argparse, json, os
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); OBJ = os.path.join(os.path.dirname(HERE), 'objects')
ap = argparse.ArgumentParser(); ap.add_argument('id'); ap.add_argument('out')
ap.add_argument('--from', dest='f0', type=float, required=True); ap.add_argument('--to', dest='f1', type=float, required=True)
ap.add_argument('--k', type=float, required=True); ap.add_argument('--max', type=int, default=4800)
a = ap.parse_args()
im = Image.open(os.path.join(OBJ, a.id + '.png')).convert('RGBA'); W, H = im.size
x0, x1 = round(a.f0 * W), round(a.f1 * W)
mid = im.crop((x0, 0, x1, H)).resize((round((x1 - x0) * a.k), H), Image.LANCZOS)
out = Image.new('RGBA', (x0 + mid.width + (W - x1), H)); out.paste(im.crop((0, 0, x0, H)), (0, 0)); out.paste(mid, (x0, 0)); out.paste(im.crop((x1, 0, W, H)), (x0 + mid.width, 0))
s = min(1, a.max / max(out.size))
if s < 1: out = out.resize((round(out.width * s), round(out.height * s)), Image.LANCZOS)
out.save(os.path.join(OBJ, a.out + '.png'), optimize=True)
meta = json.load(open(os.path.join(OBJ, a.id + '.json')))
def mx(nx):
    px = nx * W
    px = px if px <= x0 else (x0 + (px - x0) * a.k if px <= x1 else x0 + (x1 - x0) * a.k + (px - x1))
    return round(px / (x0 + mid.width + W - x1), 5)
meta['anchors'] = {k: [mx(v[0]), v[1]] for k, v in meta.get('anchors', {}).items()}
Wt = x0 + mid.width + W - x1
meta.update(id=a.out, w=out.width, h=out.height, stretch=dict(source=a.id, x_from=a.f0, x_to=a.f1, k=a.k, region=[round(x0 / Wt, 5), round((x0 + mid.width) / Wt, 5)]))
json.dump(meta, open(os.path.join(OBJ, a.out + '.json'), 'w'), indent=2)
print(a.out, out.size, meta['anchors'])
