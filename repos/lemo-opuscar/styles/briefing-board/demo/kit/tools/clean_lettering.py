#!/usr/bin/env python3
"""Remove lettering and logos from a photo before it is cut out: a large median filter inside given
rectangles keeps colour blocks and edges between them but wipes letters, logos and markings.

    python3 kit/tools/clean_lettering.py <in> <out.png> --rect x0,y0,x1,y1,size [--rect …]
"""
import argparse
import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage as ndi
ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('--rect', action='append', required=True)
a = ap.parse_args()
im = np.asarray(ImageOps.exif_transpose(Image.open(a.src)).convert('RGB')).copy()
for r in a.rect:
    x0, y0, x1, y1, k = (int(v) for v in r.split(','))
    for c in range(3): im[y0:y1, x0:x1, c] = ndi.median_filter(im[y0:y1, x0:x1, c], size=(max(3, k // 3), k))
Image.fromarray(im).save(a.out); print(a.out, im.shape)
