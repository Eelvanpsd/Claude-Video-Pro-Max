"""Every designed hit in events.json sits on the 90 BPM grid (half-beat resolution); objective clicks are foley
that follow the picture and are listed separately.   usage: python tools/cuecheck.py <demo_dir>"""
import json, sys, os
D = sys.argv[1]
TL = json.load(open(os.path.join(D, 'timeline.json'))); EV = json.load(open(os.path.join(D, 'events.json')))['ev']
half = 60 / TL['bpm'] / 2
worst = 0
for e in EV:
    if e['type'] in ('objective', 'sweep', 'scan'): continue
    off = (e['t'] / half - round(e['t'] / half)) * half * 1000
    worst = max(worst, abs(off)); print(f"{e['type']:10s} {e['t']:7.3f}  {off:+6.1f} ms")
obj = [e for e in EV if e['type'] == 'objective']
print(f"{len(obj)} objective clicks (foley on picture):", ', '.join(f"{e['t']:.2f}" for e in obj))
print(f'worst offset {worst:.1f} ms'); sys.exit(0 if worst < 1 else 1)
