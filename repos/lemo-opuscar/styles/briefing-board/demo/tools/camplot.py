#!/usr/bin/env python3
"""Plot out/camcheck.csv (written by tools/camcheck.mjs) → out/camcheck.png:
frame-content speed (px/frame), acceleration, zoom, and the share of the board's width in frame.
    python3 tools/camplot.py   (Pillow only)"""
import csv, os
from PIL import Image, ImageDraw
DEMO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = list(csv.DictReader(open(os.path.join(DEMO, 'out', 'camcheck.csv'))))
t = [float(r['t']) for r in R]; dur = t[-1]
W, H, PAD = 1800, 900, 60
im = Image.new('RGB', (W, H), (250, 249, 245)); d = ImageDraw.Draw(im)
panels = [('speed px/frame', [float(r['v']) for r in R], (31, 79, 200)), ('accel px/frame²', [float(r['a']) for r in R], (211, 58, 33)),
          ('zoom', [float(r['zoom']) for r in R], (35, 39, 46)), ('board width in frame', [float(r['wfrac']) for r in R], (90, 140, 90))]
ph = (H - PAD * 2) / len(panels)
for k, (name, ys, col) in enumerate(panels):
    y0 = PAD + k * ph; y1 = y0 + ph - 18; lo, hi = min(ys), max(ys) or 1
    if name.startswith('board'): lo, hi = 0, 1; d.line([(PAD, y1 - .46 * (y1 - y0)), (W - PAD, y1 - .46 * (y1 - y0))], fill=(200, 120, 120))
    d.rectangle([PAD, y0, W - PAD, y1], outline=(200, 198, 192))
    pts = [(PAD + (tt / dur) * (W - 2 * PAD), y1 - (v - lo) / ((hi - lo) or 1) * (y1 - y0)) for tt, v in zip(t, ys)]
    d.line(pts, fill=col, width=2); d.text((PAD + 6, y0 + 4), f'{name}  max {max(ys):.2f}', fill=(40, 40, 40))
for s in range(int(dur) + 1):
    x = PAD + s / dur * (W - 2 * PAD); d.line([(x, H - PAD), (x, H - PAD + 6)], fill=(80, 80, 80)); d.text((x - 6, H - PAD + 8), str(s), fill=(80, 80, 80))
im.save(os.path.join(DEMO, 'out', 'camcheck.png')); print(os.path.join(DEMO, 'out', 'camcheck.png'))
