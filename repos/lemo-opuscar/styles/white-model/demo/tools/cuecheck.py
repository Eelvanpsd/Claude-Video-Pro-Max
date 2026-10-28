"""Every key action sits on the 100 BPM grid (half-beats allowed) and has its sound in events.json.
usage: python -I tools/cuecheck.py <demo_dir>     exit 1 on any miss"""
import sys, os, json
D = sys.argv[1]
TL = json.load(open(os.path.join(D, 'timeline.json'))); EV = json.load(open(os.path.join(D, 'events.json')))['ev']
T = TL['T']; beat = 60 / TL['bpm']
SOUND = {'lightsOut': 'relay', 'lamp': 'lamp', 'date': 'date', 'stadhuis': 'pin', 'g1': 'layer', 'g2': 'layer', 'g3': 'layer', 'g4': 'layer',
         'hgt0': 'climb', 'hgtTop': 'top', 'dark': 'dark', 'sun': 'sun', 'noon': 'noon', 'line0': 'line', 'lineEnd': 'lineEnd',
         'roofs0': 'roof', 'roofs1': 'roof', 'lights': 'lights', 'end': 'end'}
bad = 0
print(f'{"cue":10s} {"time":>7s} {"beat":>6s} {"grid ms":>8s}  sound')
for k, snd in SOUND.items():
    t = T[k]; b = t / beat; off = (b * 2 - round(b * 2)) * beat / 2 * 1000
    hit = [e for e in EV if e['type'] == snd and abs(e['t'] - t) < 0.002]
    ok = abs(off) < 1 and bool(hit); bad += not ok
    print(f'{k:10s} {t:7.3f} {b:6.2f} {off:8.1f}  {snd if hit else "MISSING " + snd} {"" if ok else "<--"}')
print('all cues on the grid with their sounds' if not bad else f'{bad} cue(s) off')
sys.exit(1 if bad else 0)
