#!/usr/bin/env python3
"""Cue check: every visual hit in scenes/film.json lands on the music grid (120 BPM, sixteenth notes;
landings, the stamp and the arrows sit on beats or eighths, pops and small tags may take sixteenths).
    python3 tools/cuecheck.py [--grid 0.125] [--tol 0.001]
Hits: photo landings, the stamp, pier magnets, pops, strikes, the ruler, arrowheads, tags, the reveal.
Exit 1 if any hit misses the grid by more than --tol seconds."""
import json, os, sys, argparse
ap = argparse.ArgumentParser(); ap.add_argument('--grid', type=float, default=.125); ap.add_argument('--tol', type=float, default=.001); a = ap.parse_args()
DEMO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sc = json.load(open(os.path.join(DEMO, 'scenes', 'film.json')))
HITS = {'land', 'stamp', 'pier', 'strike', 'ruler', 'arrow', 'tag', 'reveal'}
bad = 0; rows = []
for e in sc['ev']:
    if e['type'] not in HITS: continue
    g = round(e['t'] / a.grid) * a.grid; off = (e['t'] - g) * 1000
    ok = abs(off) <= a.tol * 1000; bad += not ok
    rows.append((e['t'], e['type'], g, off, ok))
for t, ty, g, off, ok in rows:
    print(f"{'OK ' if ok else 'BAD'} {ty:7s} {t:7.3f} s  grid {g:7.3f}  {off:+6.1f} ms")
print(f"cuecheck: {len(rows) - bad}/{len(rows)} hits on the sixteenth-note grid" + ('' if not bad else f', {bad} off'))
sys.exit(1 if bad else 0)
