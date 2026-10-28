#!/usr/bin/env python3
"""Make a two-pylon main span from a photographed single pylon: the cut-out must start exactly at
mid-span on its left edge ([half main span | pylon | back span]). The mirror image is joined on the
left, giving [back span | pylon | main span | pylon | back span]. CREDITS says so.

    python3 kit/tools/mirror_span.py <half_id> <out_id> --pylon 0.68 --water 0.995
"""
import argparse, json, os
from PIL import Image, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__)); OBJ = os.path.join(os.path.dirname(HERE), 'objects')
ap = argparse.ArgumentParser(); ap.add_argument('id'); ap.add_argument('out')
ap.add_argument('--pylon', type=float, required=True, help='pylon centre, normalised x in the half'); ap.add_argument('--water', type=float, required=True)
ap.add_argument('--max', type=int, default=4800)
a = ap.parse_args()
half = Image.open(os.path.join(OBJ, a.id + '.png')).convert('RGBA'); W, H = half.size
out = Image.new('RGBA', (2 * W - 1, H)); out.paste(ImageOps.mirror(half), (0, 0)); out.alpha_composite(half, (W - 1, 0))
s = min(1, a.max / max(out.size))
if s < 1: out = out.resize((round(out.width * s), round(out.height * s)), Image.LANCZOS)
out.save(os.path.join(OBJ, a.out + '.png'), optimize=True)
meta = json.load(open(os.path.join(OBJ, a.id + '.json')))
meta.update(id=a.out, w=out.width, h=out.height, mirror=dict(source=a.id), anchors={'L': [round(.5 - a.pylon / 2, 5), a.water], 'R': [round(.5 + a.pylon / 2, 5), a.water]})
json.dump(meta, open(os.path.join(OBJ, a.out + '.json'), 'w'), indent=2)
print(a.out, out.size, meta['anchors'])
