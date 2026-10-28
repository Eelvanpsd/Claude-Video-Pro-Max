#!/usr/bin/env python3
"""Mask for thin parts shot against a clear sky (cables, stays, hangers, masts): key out the sky
by colour, only above a hand-drawn line (the horizon / deck), so hills and water below are never
keyed in. Output: a greyscale mask at the cropped size, for prep_object.py --mask-max.

    python3 kit/tools/sky_key.py <raw> <out_mask.png> --crop x0,y0,x1,y1 --above "x,y x,y …" [--lo 18 --hi 55]

--above: a polyline in cropped pixels; only pixels above it are considered (the sky region).
Thin dark parts are found with a black top-hat: the sky is estimated by a grey closing (which
removes anything thinner than --size px), and a pixel counts as object when it is darker than that
estimate by --lo … --hi grey levels.
"""
import argparse
import numpy as np
from PIL import Image, ImageOps, ImageDraw
from scipy import ndimage as ndi
ap = argparse.ArgumentParser(); ap.add_argument('raw'); ap.add_argument('out')
ap.add_argument('--crop'); ap.add_argument('--rotate', type=float, default=0)
ap.add_argument('--above', required=True); ap.add_argument('--exclude', action='append', default=[], help='polygon left to BiRefNet (a pylon, a tower)'); ap.add_argument('--lo', type=float, default=5); ap.add_argument('--hi', type=float, default=22); ap.add_argument('--size', type=int, default=17); ap.add_argument('--light', action='store_true', help='thin parts LIGHTER than the sky (white stay cables)')
a = ap.parse_args()
im = ImageOps.exif_transpose(Image.open(a.raw)).convert('RGB')
if a.rotate: im = im.rotate(a.rotate, Image.BICUBIC, expand=True)
if a.crop: im = im.crop(tuple(int(v) for v in a.crop.split(',')))
x = np.asarray(im, np.float32)
lum = x @ np.array([.2126, .7152, .0722], np.float32)
if a.light:
    sky = ndi.grey_opening(lum, size=(a.size, a.size)); diff = lum - sky
else:
    sky = ndi.grey_closing(lum, size=(a.size, a.size)); diff = sky - lum
obj = np.clip((diff - a.lo) / (a.hi - a.lo), 0, 1)
pts = [tuple(float(v) for v in p.split(',')) for p in a.above.split()]
W, H = im.size
poly = Image.new('L', im.size, 0); ImageDraw.Draw(poly).polygon([(0, 0), (W, 0)] + [(W, pts[-1][1])] + pts[::-1] + [(0, pts[0][1])], fill=255)
dr = ImageDraw.Draw(poly)
for ex in a.exclude: dr.polygon([tuple(float(v) for v in q.split(',')) for q in ex.split()], fill=0)
region = ndi.gaussian_filter(np.asarray(poly, np.float32) / 255, 1.0)
m = obj * region
Image.fromarray((m * 255 + .5).astype(np.uint8), 'L').save(a.out)
Image.fromarray((region * 255 + .5).astype(np.uint8), 'L').save(a.out.replace('.png', '_region.png'))   # where the key applies
print(a.out, im.size)
