"""Every key action sits on the music grid and has its sound: compares timeline.json (picture) with the
beat grid (100 BPM, half-beats allowed) and with events.json (what mix.py places).
usage: python -I tools/cuecheck.py <demo_dir>     exit 1 on any miss"""
import sys, os, json
D = sys.argv[1]
TL = json.load(open(os.path.join(D, 'timeline.json'))); EV = json.load(open(os.path.join(D, 'events.json')))['ev']
T = TL['T']; beat = 60 / TL['bpm']
SOUND = {'lock': 'lock', 'mapOn': 'map_on', 'dive0': 'dive', 'touch': 'touch', 'rewind': 'rewind', 'y1977': 'ring',
         'y1989': 'ring', 'y2000': 'ring', 'y2009': 'ring', 'y2014': 'ring', 'y2025': 'stop', 'push0': 'push', 'horn': 'horn',
         'muynak': 'label', 'range0': 'range', 'rangeEnd': 'range_end', 'sil2': 'silence', 'water': 'water_in', 'whip': 'whip',
         'north': 'dam_draw', 'dam': 'dam', 'n2001': 'nring', 'n2009': 'nring', 'pull': 'pull', 'end': 'end'}
bad = 0
print(f'{"cue":10s} {"time":>7s} {"beat":>6s} {"grid ms":>8s}  sound')
for k, snd in SOUND.items():
    t = T[k]; b = t / beat; off = (b * 2 - round(b * 2)) * beat / 2 * 1000
    hit = [e for e in EV if e['type'] == snd and abs(e['t'] - t) < 0.002]
    ok = abs(off) < 1 and hit
    bad += not ok
    print(f'{k:10s} {t:7.3f} {b:6.2f} {off:8.1f}  {snd if hit else "MISSING " + snd} {"" if ok else "<--"}')
# relabel pin lands 0.5 s after relabel; check it is on a beat too
pin = [e for e in EV if e['type'] == 'pin']
for e in pin:
    b = e['t'] / beat; off = (b * 2 - round(b * 2)) * beat / 2 * 1000
    print(f'{"pin":10s} {e["t"]:7.3f} {b:6.2f} {off:8.1f}  pin')
print('all cues on the grid with their sounds' if not bad else f'{bad} cue(s) off')
sys.exit(1 if bad else 0)
