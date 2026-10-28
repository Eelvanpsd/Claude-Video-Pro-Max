#!/usr/bin/env python3
"""Set bow / stern anchors of a side-view ship cut-out at its water line (the lowest wide row).
    python3 kit/tools/ship_anchors.py <id> [--bow left|right]"""
import argparse, json, os
import numpy as np
from PIL import Image
OBJ = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'objects')
ap = argparse.ArgumentParser(); ap.add_argument('id'); ap.add_argument('--bow', default='left'); a = ap.parse_args()
al = np.asarray(Image.open(os.path.join(OBJ, a.id + '.png')))[..., 3] > 128; H, W = al.shape
wl = int(np.where(al.mean(1) > .5)[0].max()); cols = np.where(al.any(0))[0]
m = json.load(open(os.path.join(OBJ, a.id + '.json')))
ends = [cols.min() / W, cols.max() / W]; bow, stern = (ends if a.bow == 'left' else ends[::-1])
m['anchors'] = {'bow': [round(bow, 5), round(wl / H, 5)], 'stern': [round(stern, 5), round(wl / H, 5)]}
json.dump(m, open(os.path.join(OBJ, a.id + '.json'), 'w'), indent=2); print(a.id, m['anchors'])
