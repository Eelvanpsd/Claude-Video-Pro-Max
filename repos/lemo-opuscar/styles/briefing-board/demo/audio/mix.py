"""Score, sound design and mix for "The Ship Decides" → out/mix.wav (48 kHz stereo), plus stems.
Reads the same timeline as the picture: scenes/film.json (dur, cues, sound events) and audio/vo/.
Run from anywhere with the library's Python:  $LIB/.venv/bin/python audio/mix.py

Score: 120 BPM, D minor turning to D major at the reveal. Electric bass, a MuldjordKit groove,
claves and woodblock, low brass stabs (trombone, tuba, horn), timpani, tubular bells. The ship's
horn is tuned to D: at the reveal it is the root of the chord. No piano, no string pad.
"""
import json, os, sys
import numpy as np, soundfile as sf, soxr
HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(HERE)
LIB = os.environ.get('LIB') or os.path.abspath(os.path.join(DEMO, '../../..'))
sys.path.insert(0, LIB)
from core.audio import sampler as S
from core.audio.sfx import SR, add, compress, noise, bp, lp, hp, t_, env_exp, norm, whoosh, thump, clack, brown

S.seed(23); rng = np.random.default_rng(9)
scene = json.load(open(os.path.join(DEMO, 'scenes/film.json')))
DUR = scene['dur']; EV = scene['ev']; C = scene['cues']
N = int((DUR + 1) * SR)
B = .5                                   # beat at 120 BPM
SIL = [tuple(C['sil1']), tuple(C['sil2'])]
REVEAL = C['reveal']
SEC = C['sec']; CR0 = SEC['crawl'][0]; CR1 = CR0 + SEC['crawl'][1]; AFTER = SEC['after']
def silent(t, pad=0): return any(a - pad <= t < b for a, b in SIL)
music = np.zeros((N, 2), np.float32); fx = np.zeros((N, 2), np.float32); amb = np.zeros((N, 2), np.float32); vo = np.zeros((N, 2), np.float32)

# ================================================================= score
ev = []
def note(t, inst, p, d, v, pan=0, **k):
    if t < 0 or t >= DUR: return
    for a, b in SIL:              # nothing sounds into a silence
        if t < a < t + d: d = max(.05, a - t - .03)
        if a <= t < b: return
    ev.append(dict(t=t, inst=inst, pitch=p, dur=d, vel=v, pan=pan, **k))
def hit(t, inst, var, v, gain=1.0, pan=0):
    if silent(t) or t < 0 or t >= DUR: return
    x = S.hit(inst, var, v); add(music, x, t, gain, pan)

# chord plan per bar (2 s): bass root, chord tones
PLAN = {0: ('D2', 'Dm'), 1: ('D2', 'Dm'), 2: ('Bb1', 'Bb'), 3: ('C2', 'C'), 4: ('D2', 'Dm'), 5: ('Bb1', 'Bb'), 6: ('F2', 'F'),
        7: ('C2', 'C'), 8: ('D2', 'Dm'), 9: ('Bb1', 'Bb'), 10: ('G1', 'Gm'), 11: ('D2', 'Dm'), 12: ('G1', 'Gm'), 13: ('A1', 'A'),
        14: ('A1', 'A'), 15: ('Bb1', 'Bb'), 16: ('G1', 'Gm'), 17: ('A1', 'Asus'), 18: ('D2', 'D'), 19: ('D2', 'D'), 20: ('D2', 'D')}
NBAR = len(PLAN)
def bar(i): return i * 4 * B

# --- bass: eighth-note figure, muted (short) except where it breathes
FIG = [0, 0, 12, 0, 0, 7, 12, 10]       # semitones over the root
for i in range(NBAR):
    root, _ = PLAN[i]; t0 = bar(i)
    if 8.0 <= t0 < 10.7 or t0 >= AFTER: continue
    for k, iv in enumerate(FIG):
        t = t0 + k * B / 2
        if CR0 <= t < CR1: continue           # the crawl has its own line
        if 8.0 <= t < 10.75 or t >= AFTER: continue
        v = (.62 if k % 2 == 0 else .48) * (.8 if t < 3.0 else 1.0)
        note(t, 'electric_bass', S.midi(root) + iv, .2 if k % 2 else .32, v, 0)
# half-time after the stamp: a held root and low toms
note(8.0, 'electric_bass', 'D2', 2.6, .7); note(8.0, 'contrabass', 'D2', 2.7, .45, 0, attack=.05)
for t in (9.0, 10.0): hit(t, 'toms', 'low_mallet', .55, .8, -.2)
# the crawl: bass climbs in eighths while the cable-stayed line creeps past the bank
for k, p in enumerate(['G1', 'A1', 'Bb1', 'B1', 'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2'][:12]):
    note(CR0 + k * .125, 'electric_bass', p, .12, .55 + k * .02)
note(CR1, 'electric_bass', 'A1', .45, .7)
# after the verdict: bass drops to whole notes under L9, then out
for dt, p in ((0, 'G1'), (1.0, 'G1'), (2.0, 'A1'), (2.75, 'A1')): note(AFTER + dt, 'electric_bass', p, .7, .55)

# --- drums
def kit(t, var, v, gain=.8, pan=0): hit(t, 'drum_kit', var, v, gain, pan)
for i in range(NBAR):
    t0 = bar(i)
    for s in range(16):
        t = t0 + s * B / 4
        if t >= AFTER: break
        groove_a = t < 7.0 or SEC['rule'] <= t < SEC['bench']
        groove_b = SEC['bench'] <= t < AFTER
        if groove_a:
            if s in (0, 6, 8): kit(t, 'kick_drum_left', .55, .85)
            if s in (3, 7, 11, 14) and t >= .5: hit(t, 'claves', None, .45, .35, .3)
            if t >= 3.0 and s % 2 == 0 and not (6.0 <= t < 7.0): hit(t, 'hihat', 'closed', .32 if s % 4 == 0 else .22, .3, .35)
        elif groove_b:
            if s in (0, 8, 10): kit(t, 'kick_drum_left', .7, .9)
            if s in (4, 12): kit(t, 'snare_1', .55, .55, -.05)
            if s % 2 == 0: hit(t, 'hihat', 'closed' if s % 4 else 'closed', .34 if s % 4 == 0 else .24, .3, .35)
# fills: the crawl's shaker swell, the snare build into the suspension, the rocket
for k in range(24): hit(CR0 + k * .0625, 'shaker', 'down' if k % 2 else 'up', .2 + k * .02, .45, .4)
for k in range(16): kit(SEC['build'] + k * .0625, 'snare_2', .25 + k * .045, .5, -.1)
# --- low brass: stabs on landings and verdicts (short), long chords at the reveal — placed on the picture's own events
CH = {'Dm': ['D3', 'F3', 'A3'], 'Bb': ['Bb2', 'D3', 'F3'], 'F': ['F2', 'A2', 'C3'], 'C': ['C3', 'E3', 'G3'], 'Gm': ['G2', 'Bb2', 'D3'],
      'A': ['A2', 'C#3', 'E3'], 'Asus': ['A2', 'D3', 'E3'], 'D': ['D3', 'F#3', 'A3']}
def chord_at(t): return PLAN[min(NBAR - 1, int(t // (4 * B)))]
def stab(t, ch, v=.6, root=None):
    for j, p in enumerate(CH[ch]): note(t + j * .008, 'trombone_stac', p, .3, v, -.25 + .25 * j)
    if root: note(t, 'tuba_stac', root, .35, v)
EVT = lambda ty: [e for e in EV if e['type'] == ty]
T0 = C['stamp']; stab(T0, 'Dm', .85, 'D2'); hit(T0, 'timpani', 'drum1', .8, .9); hit(T0, 'gran_cassa', 'hit', .7, .8)
HK = C['hook']; stab(HK, 'Dm', .7, 'D2'); hit(HK, 'toms', 'low_mallet', .7, .8, -.1); kit(HK, 'kick_drum_left', .8, .9)   # the width snaps across
for e in EVT('land'):                       # each photo lands on a downbeat with a brass stab in the bar's chord
    if e.get('size') == 'card': note(e['t'], 'glockenspiel', 'D6', 1.5, .3, .2); continue
    root, ch = chord_at(e['t'])
    if e.get('size') == 'big': stab(e['t'], 'A', .72, 'A1'); hit(e['t'], 'timpani', 'drum3', .75, .8); kit(e['t'], 'kick_drum_left', .9, .9)
    else: stab(e['t'], ch, .5, root)
for e in EVT('strike'):                     # struck out: a low, slightly sour blat
    t = e['t']; note(t, 'trombone_stac', 'D3', .25, .62, -.2); note(t + .01, 'trombone_stac', 'Eb3', .25, .5, .2); note(t, 'tuba_stac', 'D2', .3, .55)
barely = [e for e in EVT('tag') if e.get('v', 0) >= .85]
for e in barely: note(e['t'], 'horn_stac', 'A4', .4, .55, .1); note(e['t'], 'horn_stac', 'E4', .4, .45, -.1)          # "just enough"
ROCKET = max(e['t'] for e in EVT('arrow') if e['t'] < REVEAL)   # the suspension's line lands: a bright VI
hit(ROCKET, 'crash', None, .7, .55, .2); kit(ROCKET, 'crash_left', .8, .45, -.3)
for j, p in enumerate(['Bb2', 'F3', 'D4']): note(ROCKET, 'trombone', p, 1.4, .62, -.3 + .3 * j)
for j, p in enumerate(['F4', 'Bb4', 'D5']): note(ROCKET, 'horn', p, 1.5, .5, -.3 + .3 * j)
note(ROCKET, 'tuba', 'Bb1', 1.5, .6)
RING = [C['ring']]
for t in RING: note(t, 'vibraphone_hard', 'D5', .8, .4, .2); note(t + .125, 'vibraphone_hard', 'A5', .8, .35, -.2)
# the verdict: the title is written to a horn line that falls by a fifth, like the ship's horn (A → D)
TITLE_T = C['title_t']   # the verdict is written over the reveal chord: the horn falls A → D in D major
for t, p, d in zip(TITLE_T, ['A4', 'F#4', 'E4', 'D4', 'A4'], [.24, .24, .24, .5, .9]):
    note(t, 'horn', p, d, .5, .15)
for j, p in enumerate(['G2', 'D3']): note(AFTER + j * .01, 'trombone', p, 1.95, .3, -.2 + .4 * j)
for j, p in enumerate(['A2', 'E3']): note(AFTER + 2.0 + j * .01, 'trombone', p, 1.3, .3, -.2 + .4 * j)
# the reveal: D major, low brass and bells over the tuned horn
R = REVEAL
note(R, 'tuba', 'D2', 5.2, .7); note(R, 'contrabass', 'D2', 5.2, .5, 0, attack=.2)
for j, p in enumerate(['D3', 'A3']): note(R + .02, 'trombone', p, 5.0, .62, -.35 + .7 * j)
for j, p in enumerate(['F#4', 'A4', 'D5']): note(R + .05 + j * .03, 'horn', p, 4.8, .55, -.3 + .3 * j, attack=.25)
note(R, 'tubular_bells', 'D5', 4.0, .55, .2); note(R + 1.0, 'tubular_bells', 'A4', 3.5, .35, -.2)
hit(R, 'timpani', 'drum1', .85, .9); hit(R, 'sus_cymbal', 'cresc', .4, .35, .1)
note(R + 2.0, 'glockenspiel', 'F#6', 2.0, .2, .3); note(R + 2.5, 'glockenspiel', 'A6', 2.0, .18, -.3)
for k, (dt, p) in enumerate(((3.0, 'D6'), (3.5, 'F#6'), (4.0, 'A6'), (4.75, 'D7'))): note(R + dt, 'glockenspiel', p, 1.6, .2 - .02 * k, (-.3, .3)[k % 2])
note(R + 3.5, 'vibraphone', 'A4', 2.0, .22, -.2); note(R + 4.5, 'vibraphone', 'D5', 1.5, .2, .2)

mus = S.render([(e['t'], e['inst'], e['pitch'], e['dur'], e['vel'], e['pan']) if 'attack' not in e else dict(t=e['t'], inst=e['inst'], pitch=e['pitch'], dur=e['dur'], vel=e['vel'], pan=e['pan'], attack=e['attack']) for e in ev], dur=N / SR, master=False)
music[:len(mus)] += mus[:N]
music = S.room(music, size=.35, mix=.14)
# the dive before silence 1: a low-pass sweep from 5.6 s, then nothing until the stamp
def lp_sweep(x, t0, t1, f0, f1):
    a, b = int(t0 * SR), int(t1 * SR); seg = x[a:b].copy(); n = b - a; out = np.zeros_like(seg); blk = 1024
    for i in range(0, n, blk):
        f = f0 * (f1 / f0) ** (i / n); out[i:i + blk] = lp(seg[max(0, i - 4096):i + blk].T, f).T[-len(seg[i:i + blk]):]
    x[a:b] = out
lp_sweep(music, 5.6, SIL[0][0], 9000, 260)
for a, b in SIL: music[int(a * SR):int(b * SR)] *= 0.0

# ================================================================= sound design (procedural, on the picture's events)
def marker(d, kind='line', seed=0, v=1.0):
    r = np.random.default_rng(abs(int(seed))); n = int(d * SR); tt = np.arange(n) / SR
    bed = bp(r.standard_normal(n), 1800, 6500) * (.5 + .5 * np.sin(2 * np.pi * (7 + r.random() * 5) * tt)) * .35
    x = bed.copy(); count = int(d * (10 if kind == 'write' else 4)) + 1
    for k in range(count):
        st = r.uniform(0, max(.01, d - .1)); ln = r.uniform(.035, .12); m = int(ln * SR); s0 = int(st * SR)
        f0 = r.uniform(1900, 3400); f = f0 * (1 + .18 * np.sin(np.linspace(0, np.pi * r.uniform(1, 3), m))) + 40 * np.sin(2 * np.pi * 30 * np.arange(m) / SR)
        ph = 2 * np.pi * np.cumsum(f) / SR
        sq = (np.sin(ph) + .35 * np.sin(2 * ph) + .15 * np.sin(3 * ph)) * np.sin(np.linspace(0, np.pi, m)) ** 1.5
        x[s0:s0 + m] += sq[:max(0, min(m, n - s0))] * r.uniform(.25, .6)
    fade = np.minimum(1, np.minimum(tt / .015, (d - tt) / .03))
    return (x * fade * v).astype(np.float32)
def tap(v=1.0, f=1.0):     # marker nib tapping the enamel
    d = .06; tt = t_(d)
    return (norm(hp(noise(d), 2500) * env_exp(d, .002) + np.sin(2 * np.pi * 900 * f * tt) * env_exp(d, .008) * .6 + np.sin(2 * np.pi * 180 * tt) * env_exp(d, .02) * .4) * v).astype(np.float32)
def magnet_snap(v=1.0, heavy=False, pitch=1.0):
    d = .14; tt = t_(d)
    tr = hp(noise(d), 3000) * env_exp(d, .0012)
    ring = sum(a * np.sin(2 * np.pi * f * pitch * tt) * env_exp(d, tau) for f, a, tau in [(3400, .35, .006), (1850, .3, .01)])
    body = np.sin(2 * np.pi * (140 if heavy else 210) * pitch * tt) * env_exp(d, .025) * (.9 if heavy else .45)
    return (norm(tr + ring + body) * v).astype(np.float32)
def pop_off(v=1.0, pitch=1.0):  # a magnet pulled off: suction release + a light tick
    d = .12; tt = t_(d); f = (300 + 900 * tt / d) * pitch
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .03) * .7 + hp(noise(d), 4000) * env_exp(d, .003) * .5
    return (norm(x) * v).astype(np.float32)
def landing(v=1.0, size='mid'):
    d = .8; tt = t_(d); f = 48 if size == 'big' else 66
    low = np.sin(2 * np.pi * f * tt * (1 - .25 * tt)) * env_exp(d, .13 if size == 'big' else .08)
    board = bp(noise(d), 150, 520) * env_exp(d, .06) * .8
    slap = hp(noise(d), 1200) * env_exp(d, .006) * .55
    rattle = np.zeros_like(tt)
    if size == 'big':
        for k in range(5): s0 = int((.03 + k * .045) * SR); c_ = clack(.7 + .1 * k, .25 / (k + 1)); rattle[s0:s0 + len(c_)] += c_[:len(rattle) - s0]
    return (norm(low * 1.15 + board + slap + rattle) * v).astype(np.float32)
def friction(d, low=False):
    n = len(t_(d)); tt = np.arange(n) / SR
    x = bp(rng.standard_normal(n), 250 if low else 600, 1800 if low else 4000) * (.6 + .4 * np.sin(2 * np.pi * 13 * tt))
    return (x * np.sin(np.pi * tt / d) ** .7 * .6).astype(np.float32)
def steel_ruler(v=1.0):
    d = 1.1; tt = t_(d)
    ring = sum(a * np.sin(2 * np.pi * f * tt + p) * env_exp(d, tau) for f, a, tau, p in [(523, .5, .35, 0), (1391, .4, .22, 1), (2716, .3, .14, 2), (4107, .2, .08, .5), (6150, .1, .05, 1.5)])
    ld = landing(1, 'mid'); ld = np.pad(ld, (0, max(0, len(tt) - len(ld))))[:len(tt)]
    x = ring * .6 + ld * .8
    out = norm(x) * v
    m2 = magnet_snap(.7, True); out[int(.035 * SR):int(.035 * SR) + len(m2)] += m2[:len(out) - int(.035 * SR)]
    return out.astype(np.float32)
def stamp_sfx(v=1.0):
    d = .6; tt = t_(d)
    low = np.sin(2 * np.pi * 58 * tt * (1 - .3 * tt)) * env_exp(d, .09)
    squish = lp(noise(d), 900) * env_exp(d, .025) * .9
    slap = hp(noise(d), 1500) * env_exp(d, .004) * .7
    return (norm(low * 1.2 + squish + slap) * v).astype(np.float32)
def ship_horn(dur=2.2, f0=73.42, far=False, v=1.0):
    n = int((dur + .8) * SR); tt = np.arange(n) / SR
    env = np.minimum(1, tt / .18) * np.clip((dur + .6 - tt) / .6, 0, 1) ** 1.5
    bend = 1 - .018 * np.exp(-tt / .25)
    x = np.zeros(n)
    for f, a in ((f0, 1.0), (f0 * 1.5, .7)):              # two-tone horn: root and fifth
        ph = 2 * np.pi * np.cumsum(f * bend * (1 + .002 * np.sin(2 * np.pi * 4.3 * tt))) / SR
        for h in range(1, 14):
            x += a * np.sin(h * ph) / h ** .9 * (1.6 if 3 <= h <= 7 else 1)   # brassy middle harmonics
    x = bp(x, 60, 1400 if far else 3200) * env + bp(rng.standard_normal(n), 300, 1800) * env * .03
    y = np.stack([x, x], 1).astype(np.float32); y = S.room(y, size=.85 if far else .6, mix=.5 if far else .3)
    return (y[:, 0] / (np.abs(y).max() + 1e-9) * v).astype(np.float32)
def engine(d, v=1.0):
    d = round(d * SR) / SR; n = len(t_(d)); tt = np.arange(n) / SR
    x = lp(brown(d), 160) * (1 + .55 * np.sin(2 * np.pi * 6.5 * tt)) + np.sin(2 * np.pi * 44 * tt) * .25 * (1 + .5 * np.sin(2 * np.pi * 6.5 * tt))
    e = np.minimum(1, tt / .5) * np.minimum(1, (d - tt) / .4)
    return (norm(x) * e * v).astype(np.float32)
def water(d, v=1.0, seed=3):
    r = np.random.default_rng(abs(int(seed))); n = int(d * SR); out = np.zeros(n); t = 0.0
    while t < d - .2:
        ln = r.uniform(.15, .4); m = int(ln * SR); s0 = int(t * SR); seg = bp(r.standard_normal(m), r.uniform(250, 500), r.uniform(900, 1600)) * np.sin(np.linspace(0, np.pi, m)) ** 2
        out[s0:s0 + m] += seg[:n - s0] * r.uniform(.4, 1.0); t += r.uniform(.18, .45)
    e = np.minimum(1, np.arange(n) / SR / .4) * np.minimum(1, (d - np.arange(n) / SR) / .5)
    return (norm(out) * e * v).astype(np.float32)
def room_tone(d):
    """the room: air conditioning (a broadband wash, the fan's hum) and, through the window, a traffic bed with cars passing"""
    d = round(d * SR) / SR; n = len(t_(d)); tt = np.arange(n) / SR
    hvac = bp(rng.standard_normal(n), 120, 1500) * .5 + lp(brown(d), 300) * .3 + (np.sin(2 * np.pi * 118 * tt) + .4 * np.sin(2 * np.pi * 236 * tt)) * .06
    traffic = lp(brown(d), 260) * .45
    r = np.random.default_rng(41); t = .8
    while t < d - 2:
        ln = r.uniform(2.2, 3.6); m = int(ln * SR); s0 = int(t * SR)
        sw = bp(r.standard_normal(m), r.uniform(160, 280), r.uniform(1100, 2200)) * np.sin(np.linspace(0, np.pi, m)) ** 2 * r.uniform(.6, 1.1)
        traffic[s0:s0 + m] += sw[:max(0, min(m, n - s0))]
        t += r.uniform(3.0, 6.0)
    return hvac.astype(np.float32), traffic.astype(np.float32)

for e in EV:
    t, ty, v = e['t'], e['type'], e.get('v', 1.0)
    if ty == 'ink': add(fx, marker(e['d'], e.get('kind', 'line'), int(t * 100) + 1, v), t, .17 if e.get('kind') == 'write' else .13, pan=.08)
    elif ty == 'dimzip': add(fx, marker(e['d'], 'line', int(t * 100) + 7, 1.2), t, .16 * v, pan=.1)
    elif ty == 'scribble': add(fx, marker(e['d'], 'write', int(t * 100) + 3, .7), t, .1 * v, pan=-.1)
    elif ty == 'arrow': add(fx, tap(v), t, .3, pan=.1)
    elif ty == 'tick': add(fx, tap(v, 1.3), t, .22, pan=-.15)
    elif ty == 'pier': add(fx, magnet_snap(.8, False, 1 + .04 * (e['n'] - 3)), t, .26, pan=-.3 + .1 * e['n'])
    elif ty == 'pin': add(fx, magnet_snap(v, True, 1.12), t, .3, pan=rng.uniform(-.25, .25))
    elif ty == 'pop': add(fx, pop_off(.9, 1 + .05 * e['n']), t, .3, pan=-.3 + .1 * e['n'])
    elif ty == 'tag': add(fx, magnet_snap(v), t, .38 * v, pan=rng.uniform(-.2, .2))
    elif ty == 'land' and e.get('size') == 'card':   # the end card: paper slap and its two magnets
        add(fx, landing(.5, 'mid'), t - .01, .3); add(fx, magnet_snap(.9, True), t, .45, -.2); add(fx, magnet_snap(.8, True, 1.06), t + .045, .4, .2)
    elif ty == 'land': add(fx, landing(v, e.get('size', 'mid')), t - .01, .62 * v)
    elif ty == 'ruler': add(fx, steel_ruler(1.0), t - .01, .5)
    elif ty == 'erase': add(fx, friction(e['d']), t, .32)
    elif ty == 'strike': add(fx, marker(.22, 'line', 77, 1.4), t, .2)
    elif ty == 'stamp': add(fx, stamp_sfx(1.0), t, .85)
    elif ty == 'whoosh': add(fx, whoosh(.45, 1.0), t - .08, .22 * v)
    elif ty == 'horn':
        h = ship_horn(2.4 if e.get('tuned') else 1.8, 73.42 if e.get('tuned') else 69.3, far=bool(e.get('far')))
        add(fx, h, t, .55 * v)
    elif ty == 'engine': add(amb, engine(e['d'], 1.0), t, .3 * v)
    elif ty == 'water': add(amb, water(e['d'], 1.0, int(t)), t, .14)
    elif ty == 'reveal': add(fx, thump(.9, 42), t, .5); add(fx, whoosh(.9, .6), t, .12)
# the silences: everything but the room drops away (40 ms fades); the first sound after each is the stamp / the horn
gate = np.ones(N, np.float32)
for a, b in SIL:
    i0, i1, f = int(a * SR), int(b * SR), int(.04 * SR)
    gate[i0:i1] = .03; gate[i0 - f:i0] = np.linspace(1, .03, f); gate[i1 - 2:i1] = .03
fx *= gate[:, None]; amb *= gate[:, None]

# ================================================================= voice
for e in EV:
    if e['type'] != 'vo': continue
    x, sr = sf.read(os.path.join(HERE, 'vo', e['id'] + '.wav'), dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    x = soxr.resample(x, sr, SR) if sr != SR else x
    x = hp(x, 80); x = compress(x / (np.abs(x).max() + 1e-9), thr=.3, ratio=3.0)
    add(vo, x, e['t'], 1.0)

def rms(x): return float(np.sqrt(np.mean(x ** 2) + 1e-12))
vmask = np.abs(vo).max(1) > 1e-4; v_rms = rms(vo[vmask])
# room tone under everything, about 20 dB under the voice: the AC on the right, the window (traffic) on the left.
# Added after the gate, so the silences keep exactly this and nothing else.
hv_, tr_ = room_tone(DUR + .5); room = np.zeros_like(amb); add(room, hv_, 0, 1.0, .25); add(room, tr_, 0, 1.0, -.5)
room *= v_rms * 10 ** (-20 / 20) / rms(room); amb += room
music *= (v_rms / rms(music[np.abs(music).max(1) > 1e-4])) * 10 ** (-8.5 / 20)      # music ~8.5 dB under the voice
win = int(.12 * SR); venv = np.convolve(np.abs(vo).max(1), np.ones(win) / win, 'same')
duck = 1 - .4 * np.clip(venv / (venv.max() * .25 + 1e-9), 0, 1)
music *= duck[:, None]; fx *= (1 - .3 * (1 - duck))[:, None]
music = hp(music.T, 36).T.astype(np.float32)
mix = music + fx * .78 + amb + vo
# low end: a 30 Hz high-pass keeps the sub tidy (measured: 20–120 Hz sits about 11 dB under 120 Hz–2 kHz by band energy)
mix = hp(mix.T, 30).T.astype(np.float32)
from scipy.ndimage import maximum_filter1d, uniform_filter1d
def bus_limit(x, ceil, look=.006, rel=.06):
    n = int(look * SR); pk = np.abs(x).max(1)
    m = maximum_filter1d(pk, size=2 * n + 1); g = np.minimum(1, ceil / np.maximum(m, 1e-9))
    g = uniform_filter1d(g, size=n); g = np.minimum(g, uniform_filter1d(g, size=int(rel * SR)))
    return x * g[:, None]
peak_rms = np.sqrt(np.mean(mix[np.abs(mix).max(1) > 1e-4] ** 2))
mix = bus_limit(mix, peak_rms * 4.5)
mix = mix / np.abs(mix).max() * .7
end = int(DUR * SR); fo = int(1.2 * SR); mix[end - fo:end] *= np.linspace(1, 0, fo)[:, None] ** 1.5
os.makedirs(os.path.join(DEMO, 'out'), exist_ok=True)
sf.write(os.path.join(DEMO, 'out/mix.wav'), mix[:end], SR)
os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
for nm, s in (('music', music), ('fx', fx), ('amb', amb), ('vo', vo)): sf.write(os.path.join(HERE, 'stems', nm + '.wav'), s[:end], SR)
print('out/mix.wav', round(DUR, 2), 's ·', len(ev), 'score notes')
