#!/usr/bin/env python3
"""A photo print for the wall: a crop of the original photograph on white photo paper.
    python3 kit/tools/make_print.py <photo> <id> --crop x0,y0,x1,y1 [--w 1100 --border .045 --sat .85]"""
import argparse, json, os
import numpy as np
from PIL import Image, ImageOps
OBJ = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'objects')
Image.MAX_IMAGE_PIXELS = None
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('id'); ap.add_argument('--crop', required=True)
ap.add_argument('--w', type=int, default=1100); ap.add_argument('--border', type=float, default=.045); ap.add_argument('--sat', type=float, default=.85)
a = ap.parse_args()
im = ImageOps.exif_transpose(Image.open(a.src)).convert('RGB').crop(tuple(int(v) for v in a.crop.split(',')))
im = im.resize((a.w, round(a.w * im.height / im.width)), Image.LANCZOS)
x = np.asarray(im, np.float32) / 255; lum = (x * [.2126, .7152, .0722]).sum(-1, keepdims=True); x = lum + (x - lum) * a.sat
im = Image.fromarray((np.clip(x, 0, 1) * 255).astype(np.uint8))
b = round(a.w * a.border); paper = Image.new('RGBA', (im.width + 2 * b, im.height + 2 * b), (250, 249, 245, 255)); paper.paste(im, (b, b))
paper.save(os.path.join(OBJ, a.id + '.png'), optimize=True)
json.dump({'id': a.id, 'w': paper.width, 'h': paper.height, 'anchors': {}, 'print': True, 'prep': vars(a)}, open(os.path.join(OBJ, a.id + '.json'), 'w'), indent=2)
print(a.id, paper.size)
