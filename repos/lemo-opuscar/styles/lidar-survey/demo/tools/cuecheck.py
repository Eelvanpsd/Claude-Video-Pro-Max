"""Every key action of the picture against the beat grid (96 BPM): prints the offset of each cue from its nearest
half-beat. usage: python -I tools/cuecheck.py <demo_dir>"""
import json, os, sys
D = sys.argv[1]
TL = json.load(open(os.path.join(D, 'timeline.json'))); EV = json.load(open(os.path.join(D, 'events.json')))['ev']
beat = 60 / TL['bpm']; worst = 0; n = 0
for e in EV:
    if e['type'] in ('vo',): continue
    off = (e['t'] / (beat / 2) - round(e['t'] / (beat / 2))) * beat / 2 * 1000
    worst = max(worst, abs(off)); n += 1
    print(f"{e['type']:8s} {e['t']:7.3f}s  {off:+6.1f} ms")
print(f'{n} cues, worst {worst:.1f} ms from the half-beat grid')
sys.exit(0 if worst < 1 else 1)
