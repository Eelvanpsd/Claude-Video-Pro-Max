"""Score, sound design and mix for 《地图上还写着海》 -> out/mix.wav (48 kHz stereo) + out/stems/.

Everything sits on the timeline (timeline.json, from timeline.js) and on the page's events (events.json),
so every hit lands on its frame.

  palette   dry first half: FM telemetry plucks, analog pulse bass, FM pings (the lock "key"), sampled
            timpani / bass drum / gran cassa / bowed cymbal / gong (reversed for the rewind)
            wet second half: glass harp (water-filled glasses), bowed vibraphone, horn, tuba; real water
  beds      orbit hum + radio hiss + data chatter; desert wind; water lapping (only after silence 2)
  voice     Kokoro (bf_emma), compressed, music ducked underneath

usage: $LIB/.venv/bin/python mix.py
"""
import json, os, sys
import numpy as np
import soundfile as sf
import soxr
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB') or os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, LIB)
from core.audio import sampler as S
from core.audio import sfx as X

SR = X.SR
TL = json.load(open(os.path.join(HERE, 'timeline.json')))
EVJ = json.load(open(os.path.join(HERE, 'events.json')))
EV = EVJ['ev']
T = TL['T']
DUR = TL['T']['dur']
N = int((DUR + 0.6) * SR)
BEAT = 60 / TL['bpm']
rng = np.random.default_rng(23)
S.seed(5)

MUS = np.zeros((N, 2)); PUL = np.zeros((N, 2)); HIT = np.zeros((N, 2)); FX = np.zeros((N, 2)); BED = np.zeros((N, 2)); VOX = np.zeros((N, 2))
tt_all = np.arange(N) / SR


# ------------------------------------------------------------------ dsp helpers
def sos(kind, f, o=2): return butter(o, f, kind, fs=SR, output='sos')
def lpf(x, f, o=2): return sosfilt(sos('low', min(f, SR * .45), o), x, axis=0)
def hpf(x, f, o=2): return sosfilt(sos('high', f, o), x, axis=0)
def bpf(x, a, b, o=2): return sosfilt(sos('band', [a, min(b, SR * .45)], o), x, axis=0)
def tv(d): return np.arange(int(d * SR)) / SR
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
def mi(n): return 12 * (int(n[-1]) + 1) + NOTE[n[:-1]]
def put(buf, x, at, g=1.0, pan=0.0):
    x = np.asarray(x, np.float64)
    if x.ndim == 2:
        s = int(at * SR)
        if s >= len(buf): return
        if s < 0: x = x[-s:]; s = 0
        e = min(len(buf), s + len(x)); buf[s:e] += x[:e - s] * g
    else:
        X.add(buf, x, at, g, pan)
def adsr(d, a=.005, r=.1, curve=1.0):
    n = int(d * SR); e = np.ones(n)
    na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na) ** curve
    nr = min(n, int(r * SR)); e[n - nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e
def saw(f, d, det=0.0, nh=40):
    t = tv(d); x = np.zeros_like(t)
    for k in range(1, nh):
        if f * k > 15000: break
        x += np.sin(2 * np.pi * f * (1 + det) * k * t) / k
    return x * .55
def fm(fc, ratio, index, d, tau_i=.15):
    t = tv(d); I = index * np.exp(-t / tau_i)
    return np.sin(2 * np.pi * fc * t + I * np.sin(2 * np.pi * fc * ratio * t))
def stereo(x, w=.0006):
    d = int(w * SR); return np.stack([x, np.concatenate([np.zeros(d), x[:-d]]) if d else x], 1)
def delay(x, at, fb, n, gain=1.0, pan_alt=.5):
    """stereo ping-pong echoes of mono x"""
    L = len(x) + int(at * n * SR) + 10; out = np.zeros((L, 2))
    for k in range(n + 1):
        s = int(at * k * SR); g = gain * fb ** k; p = 0 if k == 0 else (pan_alt if k % 2 else -pan_alt)
        l, r = np.cos((p + 1) * np.pi / 4) * 1.414, np.sin((p + 1) * np.pi / 4) * 1.414
        xx = lpf(x, 6000 - 900 * k) if k else x
        out[s:s + len(x), 0] += xx * g * l; out[s:s + len(x), 1] += xx * g * r
    return out


# ------------------------------------------------------------------ instruments (synth)
def bass(m, d, vel=.8, cut=380):
    f = hz(m); x = saw(f, d, nh=18) * .8 + np.sin(2 * np.pi * f * tv(d)) * .9 + saw(f, d, .004, nh=10) * .4
    x = lpf(x, cut, 2) + .12 * np.tanh(3 * lpf(x, 900))          # 2nd/3rd harmonics speak on small speakers
    return x * adsr(d, .012, min(.25, d * .4)) * vel * .8     # -2 dB: the low end lives in the impacts
def pluck(m, vel=.6, d=.22, bright=1.0):
    x = fm(hz(m), 2.0, 2.4 * bright, d, .035) * np.exp(-tv(d) / .07)
    return lpf(x, 3800 * bright) * vel
def ping(m, vel=.6, d=1.6):
    t = tv(d); f = hz(m)
    x = fm(f, 3.5, 3.0, d, .05) * np.exp(-t / .55) + .35 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t / .3)
    return x * vel
def pad(ms, d, vel=.25, cut=1400, a=.6, r=.9):
    x = np.zeros(int(d * SR))
    for m in ms:
        for det in (-.0035, .0, .0041):
            x += saw(hz(m), d, det, nh=24)
    t = tv(d); c = cut * (0.75 + .25 * np.sin(2 * np.pi * .21 * t))
    y = lpf(x, cut) * .7 + lpf(x, cut * .5) * .3
    return y * adsr(d, a, r) * vel / max(1, len(ms))
def metal_ring(m, vel=.5, d=2.2):
    t = tv(d); f = hz(m)
    parts = [(1.0, 1, 1.1), (2.76, .5, .7), (5.40, .3, .45), (8.93, .16, .3)]
    x = sum(a * np.sin(2 * np.pi * f * r * t + rng.random() * 6) * np.exp(-t / tau) for r, a, tau in parts)
    return x * vel * .5
def hiss(d, lo=2000, hi=9000):
    return bpf(rng.standard_normal(int(d * SR)), lo, hi)
def sweep(d, f0, f1, q=.35, vel=.5):
    """band-passed noise whose centre glides f0 -> f1 (log)"""
    n = rng.standard_normal(int(d * SR)); out = np.zeros_like(n); blk = 256
    for i in range(0, len(n), blk):
        u = i / max(1, len(n)); f = f0 * (f1 / f0) ** u
        lo, hi = f * (1 - q), min(f * (1 + q), SR * .45)
        s = max(0, i - 3000); y = sosfilt(sos('band', [lo, hi]), n[s:i + blk]); out[i:i + blk] = y[-(min(blk, len(n) - i)):]
    return out * np.sin(np.pi * np.clip(tv(d) / d, 0, 1)) ** 1.2 * vel
def thud(vel=1.0, f=48, d=1.2):
    t = tv(d); ph = 2 * np.pi * np.cumsum(f * (1 + 1.6 * np.exp(-t / .03))) / SR
    x = np.sin(ph) * np.exp(-t / .35) + lpf(rng.standard_normal(len(t)), 300) * np.exp(-t / .05) * .6
    return x * vel


def punch(vel=1.0, d=.9):
    """an impact's body in the 60-120 Hz band (two pitched-down sines + a short low-mid knock); speaks on small speakers"""
    t = tv(d)
    b1 = np.sin(2 * np.pi * np.cumsum(72 * (1 + 1.2 * np.exp(-t / .025))) / SR) * np.exp(-t / .22)
    b2 = np.sin(2 * np.pi * np.cumsum(108 * (1 + .8 * np.exp(-t / .02))) / SR) * np.exp(-t / .14) * .6
    kn = bpf(rng.standard_normal(len(t)), 90, 400) * np.exp(-t / .045) * .7
    y = b1 + b2 + kn
    return (y + .25 * np.tanh(2.5 * y)) * vel


# ------------------------------------------------------------------ beds
def wind(d, base=380, amt=1.0):
    n = len(tv(d)); w = lpf(np.cumsum(rng.standard_normal(n)) * .02, base, 2); w = hpf(w, 40)
    w /= np.abs(w).max() + 1e-9
    mod = .55 + .45 * np.interp(tv(d), np.linspace(0, d, 12), rng.random(12))
    whistle = bpf(rng.standard_normal(n), 700, 1300) * .15 * (.5 + .5 * np.sin(2 * np.pi * .23 * tv(d)))
    return (w * mod + whistle) * amt
def orbit(d):
    t = tv(d)
    hum = sum(a * np.sin(2 * np.pi * f * t) for f, a in [(55, .5), (110, .35), (165, .15), (220, .08)]) * (.8 + .2 * np.sin(2 * np.pi * .3 * t))
    radio = bpf(rng.standard_normal(len(t)), 1800, 7000) * .22
    return hum * .4 + radio
def chatter(t0, t1, density=5, vel=.12):
    k = 0
    t = t0
    while t < t1:
        f = rng.choice([1800, 2200, 2600, 3100, 1500]) * (1 + rng.random() * .05)
        d = rng.choice([.025, .04, .06]); x = np.sin(2 * np.pi * f * tv(d)) * adsr(d, .002, .01)
        put(BED, x, t, vel * (.5 + rng.random() * .5), rng.uniform(-.7, .7))
        t += rng.exponential(1 / density); k += 1
def water(d, amt=1.0):
    n = len(tv(d)); out = np.zeros(n)
    t = 0.0
    while t < d:                                    # lapping: slow swells of low-passed noise
        ld = rng.uniform(.9, 1.6); s = int(t * SR); e = min(n, s + int(ld * SR))
        w = lpf(rng.standard_normal(e - s), rng.uniform(500, 900)) * np.sin(np.pi * np.linspace(0, 1, e - s)) ** 2.2
        out[s:e] += w * rng.uniform(.6, 1.0); t += rng.uniform(.55, 1.0)
    for _ in range(int(d * 7)):                     # small bubbles / drips
        s = rng.uniform(0, d); bd = .05; f0 = rng.uniform(900, 2200)
        ph = 2 * np.pi * np.cumsum(f0 * (1 + 1.2 * tv(bd) / bd)) / SR
        b = np.sin(ph) * np.exp(-tv(bd) / .012) * .25
        i = int(s * SR); out[i:i + len(b)] += b[:max(0, min(len(b), n - i))]
    fizz = hpf(rng.standard_normal(n), 3000) * .03
    return (out / (np.abs(out).max() + 1e-9) + fizz) * amt


# ------------------------------------------------------------------ the score
D2, A2, D3 = mi('D2'), mi('A2'), mi('D3')
chords = {'Dm': ['D3', 'F3', 'A3'], 'C': ['C3', 'E3', 'G3'], 'Bb': ['Bb2', 'D3', 'F3'], 'A': ['A2', 'C#3', 'E3'], 'Gm': ['G2', 'Bb2', 'D3'],
          'D': ['D3', 'F#3', 'A3'], 'G': ['G2', 'B2', 'D3'], 'Bm': ['B2', 'D3', 'F#3'], 'Asus': ['A2', 'D3', 'E3']}
def cm(name, up=0): return [mi(n) + up for n in chords[name]]


def score():
    # ---- ORBIT + DIVE (0 .. touch): drone, telemetry pulse, ping fragment, riser
    d = T['touch']
    put(MUS, bass(D2, d + .05, .55, 260), 0.0, 1.0, 0)
    put(MUS, pad(cm('Dm', 12), d, .16, 900, a=1.2, r=.05), 0.0, 1.0, 0)
    # pulse: 8ths, 16ths once the dive starts; the filter opens with the fall
    t = 0.0; i = 0
    seq = [mi('D4'), mi('A4'), mi('F4'), mi('A4')]
    while t < d - 0.02:
        div = .5 if t < T['dive0'] else .25
        bright = .5 + .9 * np.clip((t - T['dive0']) / (d - T['dive0']), 0, 1)
        put(PUL, pluck(seq[i % 4] + (12 if (i % 8 == 7) else 0), .30 + .1 * (i % 2 == 0), .2, bright), t, 1.0, -.35 if i % 2 else .35)
        t += div * BEAT; i += 1
    # riser into touchdown
    rd = d - T['dive0']
    put(MUS, sweep(rd, 250, 5200, .3, .55), T['dive0'], 1.0, 0)
    gc = S.hit('gran_cassa', 'cresc', .85)
    put(HIT, gc[:int(rd * SR)] * np.linspace(.2, 1, min(len(gc), int(rd * SR))), d - min(len(gc) / SR, rd), .9, 0)
    rs = saw(hz(mi('D3')), rd) * 0; tt = tv(rd); fr = hz(mi('D3')) * 2 ** (tt / rd * 1.0)
    rise = np.sin(2 * np.pi * np.cumsum(fr) / SR) * (tt / rd) ** 2 * .25
    put(MUS, lpf(rise + .5 * np.tanh(2 * rise), 3000), T['dive0'], 1.0, 0)

    # ---- telemetry ticks (a dry metal tick on the grid; it divides as things speed up)
    def ticks(t0, t1, div, vel, accent_every=4):
        k = 0; tp = t0
        while tp < t1 - .01:
            v = vel * (1.0 if k % accent_every == 0 else .62)
            hh = S.hit('hihat', 'closed', min(.95, .45 + v), dur=.12)
            put(PUL, hh * v * .9, tp, 1.0, .25 if k % 2 else -.25)
            c = np.sin(2 * np.pi * 5200 * tv(.012)) * np.exp(-tv(.012) / .002)
            put(PUL, c * v * .35, tp, 1.0, -.2 if k % 2 else .2)
            tp += div * BEAT; k += 1
    ticks(T['dive0'], T['touch'] - .05, .5, .35)
    ticks(T['y1977'], T['y2000'], .5, .45)
    ticks(T['y2000'], T['y2025'] - .02, .25, .5)
    ticks(T['n2009'], T['pull'], .5, .25)
    ticks(T['pull'] + 2 * BEAT, T['end'] - .05, .5, .3)

    # ---- REWIND (rewind .. y1977): reversed gong swell
    g = S.hit('gong', None, .9); g = g[:int(2.2 * SR)][::-1]
    gl = int((T['y1977'] - T['rewind']) * SR); g = g[-gl:] * np.linspace(.3, 1, gl) ** 2
    put(HIT, stereo(g * .5), T['rewind'])

    # ---- RINGS (y1977 .. y2025): descending bass, accelerating pulse, chord pad, stamps
    plan = [('Dm', 'D2', T['y1977']), ('C', 'C2', T['y1989']), ('Bb', 'Bb1', T['y2000']), ('A', 'A1', T['y2009']), ('Gm', 'G1', T['y2014']), ('Dm', 'D2', T['y2025'])]
    for k, (ch, root, t0) in enumerate(plan[:-1]):
        t1 = plan[k + 1][2]
        put(MUS, bass(mi(root), t1 - t0 + .03, .55, 420), t0, 1.0, 0)
        put(MUS, pad(cm(ch, 12), t1 - t0 + .25, .26, 2600, a=.05, r=.25), t0, 1.0, 0)
        put(MUS, pad([n + 12 for n in cm(ch, 12)], t1 - t0 + .25, .12, 4200, a=.2, r=.3), t0, 1.0, 0)
        # pulse: 8ths first, then 16ths as the rings speed up
        div = .5 if k < 2 else .25
        tp = t0; j = 0; tones = cm(ch, 24)
        while tp < t1 - .02:
            put(PUL, pluck(tones[j % 3] + (12 if j % 4 == 3 else 0), .33, .2, 1.1), tp, 1.0, -.3 if j % 2 else .3)
            tp += div * BEAT; j += 1
    # low brass on every chord change (tuba root, trombone fifth): the floor drops with each ring
    for k, (ch, root, t0) in enumerate(plan[:-1]):
        t1 = plan[k + 1][2]; dd = t1 - t0 + .2
        put(MUS, stereo(S.note('tuba', mi(root) + (12 if mi(root) < mi('F1') else 0), dd, vel=.5 + .06 * k, attack=.25)), t0, .6)
        put(MUS, stereo(S.note('trombone', mi(root) + 7 + (12 if mi(root) + 7 < mi('A#1') else 0), dd, vel=.42 + .05 * k, attack=.3)), t0 + .05, .45)
    # a sub pulse that drives the collapse: every beat, then every half beat from 2000
    tp = T['y1977']; j = 0
    while tp < T['y2025'] - .26:
        div = 1.0 if tp < T['y2000'] else .5
        sub = np.sin(2 * np.pi * np.cumsum(58 + 70 * np.exp(-tv(.35) / .03)) / SR) * np.exp(-tv(.35) / .12)
        put(PUL, sub * (.55 + .25 * (tp > T['y2009'])), tp, 1.0, 0)
        tp += div * BEAT; j += 1
    # a reversed cymbal swells into the suck-out before the stop
    rc = S.hit('sus_cymbal', 'hit', .8)[:int(1.6 * SR)][::-1]
    put(HIT, stereo(rc * np.linspace(.2, 1, len(rc)) ** 1.5), T['y2025'] - .25 - len(rc) / SR, .55)
    # ---- hard stop on today: one low D, then only the bowed cymbal and a thin drone
    put(MUS, bass(D2, 2.6, .9, 300), T['y2025'], 1.0, 0)
    bow = S.hit('sus_cymbal', 'bow', .7)
    put(HIT, stereo(bow[:int(3.4 * SR)] * np.linspace(1, 0, min(len(bow), int(3.4 * SR))) ** .7), T['y2025'] + .02, .7)
    put(MUS, pad(cm('Dm', 0)[:1] + [mi('A2')], T['muynak'] - T['y2025'] + 1.0, .18, 500, a=1.4, r=1.2), T['y2025'] + .2, 1.0, 0)

    # ---- MUYNAK: soft timpani heartbeat, sparse; ratchet carries the rhythm
    for k, tb in enumerate(np.arange(T['push0'] + BEAT * .5, T['sil2'] - .1, 2 * BEAT)):
        put(HIT, S.note('timpani', 'D3', .9, vel=.38), tb, .8, -.1)
        put(HIT, S.note('timpani', 'A2', .6, vel=.25), tb + BEAT * .5, .5, .1)
    put(MUS, pad([mi('D3'), mi('A3'), mi('E4')], T['sil2'] - T['muynak'] + .1, .14, 700, a=1.0, r=.15), T['muynak'], 1.0, 0)
    # a low drone whose filter breathes with the line, and dry grains of sand
    dd = T['sil2'] - T['push0']; tt = tv(dd)
    dr = (saw(hz(mi('D2')), dd, nh=30) + saw(hz(mi('A1')) * 1.002, dd, nh=30) * .7)
    cut = 180 + 420 * np.clip((tt - (T['range0'] - T['push0'])) / (T['rangeEnd'] - T['range0']), 0, 1) ** 1.5
    y = np.zeros_like(dr)
    for i0 in range(0, len(dr), 2400):
        seg_ = slice(max(0, i0 - 4000), i0 + 2400); f = float(cut[min(i0, len(cut) - 1)])
        y[i0:i0 + 2400] = lpf(dr[seg_], f, 2)[-(min(2400, len(dr) - i0)):]
    y = y * adsr(dd, .8, .25) * .5 + .12 * np.tanh(2 * y)
    put(MUS, stereo(y), T['push0'], .8)
    for k in range(int(dd * 9)):
        tg = T['push0'] + rng.uniform(0, dd); gd = rng.uniform(.01, .03)
        gr_ = bpf(rng.standard_normal(int(gd * SR) + 8), 2500, 9000)[:int(gd * SR)] * np.hanning(int(gd * SR))
        put(PUL, gr_ * rng.uniform(.05, .14), tg, 1.0, rng.uniform(-.8, .8))

    # ---- NORTH: D major, glass harp motif, bowed vibraphone, horn
    tn = T['dam']
    put(MUS, bass(D2, T['pull'] - tn + .3, .5, 240), tn, 1.0, 0)
    for n, tt0, dd in [('A3', tn, 4.6), ('D4', tn + .3, 4.3), ('F#4', tn + .6, 4.0)]:
        put(MUS, stereo(S.note('vibraphone_bowed', n, dd, vel=.5)), tt0, .5)
    put(MUS, stereo(S.note('horn', 'D3', 4.2, vel=.42, attack=.8)), tn + .2, .55)
    put(MUS, stereo(S.note('horn', 'A3', 3.8, vel=.36, attack=.8)), tn + .6, .45)
    put(MUS, stereo(S.note('tuba', 'D2', T['pull'] - tn, vel=.45, attack=.6)), tn, .55)
    put(MUS, stereo(S.note('trombone', 'A2', T['pull'] - tn, vel=.38, attack=.9)), tn + .3, .45)
    put(MUS, pad(cm('D', 0) + [mi('A3')], T['pull'] - tn + .4, .2, 1800, a=1.4, r=.6), tn, 1.0, 0)
    cr = S.hit('sus_cymbal', 'cresc', .75)            # the water grows: a cymbal swell lands on the 2009 ring
    cl = min(len(cr), int((T['n2009'] - T['n2001']) * SR))
    put(HIT, stereo(cr[:cl] * np.linspace(.1, 1, cl) ** 2), T['n2009'] - cl / SR, .6)
    motif = [('D5', T['n2001']), ('A4', T['n2001'] + BEAT), ('C#5', T['n2009']), ('F#5', T['n2009'] + BEAT), ('E5', T['n2009'] + 2 * BEAT), ('D5', T['n2009'] + 3.5 * BEAT)]
    for n, t0 in motif:
        x = S.note('glass', n, 1.6, vel=.75)
        put(MUS, delay(x, BEAT * .75, .32, 3, .9), t0)
    tp = T['dam']; j = 0
    while tp < T['n2009'] - .05:   # a held breath of pulse before the water comes back
        put(PUL, S.note('vibraphone', [mi('D4'), mi('A4')][j % 2], .4, vel=.22), tp, .45, -.3 if j % 2 else .3)
        tp += BEAT; j += 1
    # soft 8th arpeggio (vibraphone) from the 2009 ring on
    tp = T['n2009']; j = 0; arp = [mi('D4'), mi('F#4'), mi('A4'), mi('D5')]
    while tp < T['pull'] - .05:
        put(PUL, S.note('vibraphone', arp[j % 4], .5, vel=.32), tp, .5, -.4 if j % 2 else .4)
        tp += .5 * BEAT; j += 1

    # ---- PULL BACK: the chord opens; dry ping and wet glass play the motif together
    tp0 = T['pull']; dpb = T['end'] - tp0
    put(MUS, bass(D2, dpb + .4, .6, 260), tp0, 1.0, 0)
    for n, v, pan in [('D3', .5, -.2), ('A3', .45, .2), ('F#4', .35, 0)]:
        put(MUS, stereo(S.note('horn', n, dpb, vel=v, attack=1.2)), tp0, .55, )
    put(MUS, stereo(S.note('tuba', 'D2', dpb, vel=.35, attack=1.0)), tp0 + .3, .45)
    for n in ('A3', 'D4', 'F#4'):
        put(MUS, stereo(S.note('vibraphone_bowed', n, dpb, vel=.45)), tp0 + .2, .45)
    put(MUS, pad(cm('D', 12), dpb, .2, 2200, a=1.6, r=1.2), tp0, 1.0, 0)
    mot2 = [('D5', T['relabel']), ('A4', T['relabel'] + BEAT), ('C#5', T['relabel'] + 2 * BEAT), ('F#5', T['relabel'] + 3 * BEAT), ('E5', T['relabel'] + 5 * BEAT), ('D5', T['relabel'] + 7 * BEAT)]
    for n, t0 in mot2:
        put(MUS, delay(S.note('glass', n, 1.6, vel=.7), BEAT * .75, .3, 3, .85), t0)
        put(MUS, delay(ping(mi(n) + 12, .22, 1.2), BEAT * .75, .3, 2, .8), t0)
    # pulse comes back, light
    tp = tp0 + 2 * BEAT; j = 0; tones = [mi('D5'), mi('A4'), mi('F#4'), mi('A4')]
    while tp < T['end'] - .05:
        put(PUL, pluck(tones[j % 4], .22, .2, .9), tp, 1.0, -.3 if j % 2 else .3)
        tp += .5 * BEAT; j += 1

    # ---- END: low D, the lock ping echoes, long tail
    te = T['end']
    put(MUS, bass(D2, 3.4, .55, 220), te, 1.0, 0)
    put(MUS, pad(cm('D', 12), DUR - te, .16, 1300, a=.05, r=2.6), te, 1.0, 0)
    put(MUS, stereo(S.note('vibraphone_bowed', 'D4', DUR - te, vel=.4)), te + .1, .45)


def foley():
    for e in EV:
        t, ty = e['t'], e['type']
        if ty == 'orbit_bed':
            o = orbit(T['touch'] + .2); o *= np.minimum(1, tv(len(o) / SR) / .15); o[-int(.12 * SR):] *= np.linspace(1, 0, int(.12 * SR))
            put(BED, stereo(o * .22), 0)
            chatter(0.1, T['touch'] - .2, 6, .05)
            # orbit returns with the pull-back
            o2 = orbit(DUR - T['pull'] - 1.0); o2 *= np.minimum(1, tv(len(o2) / SR) / 2.0)
            put(BED, stereo(o2 * .18), T['pull'] + 1.0)
            chatter(T['pull'] + 2.4, DUR - .4, 3, .035)
        elif ty == 'servo':
            dd = .5; tt = tv(dd); f = 900 + 500 * np.sin(np.pi * tt / dd)
            x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / dd) ** 2 * .12 + bpf(rng.standard_normal(len(tt)), 2000, 5000) * .05 * np.sin(np.pi * tt / dd)
            put(FX, x, t, .7, .3)
        elif ty == 'lock':
            put(FX, delay(ping(mi('D6'), .55, 1.6), BEAT * .5, .35, 3, .7), t)
            put(FX, X.click(1.3, .5), t, .7, 0)
        elif ty == 'lock2':      # the opening's lock ping, answered: the old port is locked
            put(FX, delay(ping(mi('A5'), .45, 1.4), BEAT * .5, .35, 3, .8), t)
            put(FX, X.click(1.3, .45), t, .65, 0)
        elif ty == 'shore':      # a pen drawing the 1977 shore
            dd = e['dur']; x = hpf(rng.standard_normal(int(dd * SR)), 3500) * np.linspace(1, .3, int(dd * SR)) * .13
            put(FX, stereo(x), t, .8)
        elif ty == 'coords':
            for k in range(9): put(FX, X.click(1.8 + .1 * k, .18), t + k * .028, .5, .4)
        elif ty == 'map_on':
            put(FX, X.click(.6, .5), t, .8, 0); put(FX, X.whoosh(.3, .25), t - .05, .6, 0)
            put(FX, delay(ping(mi('A5'), .3, 1.2), BEAT * .5, .3, 2, .8), t)
        elif ty == 'dive':
            dd = e['to'] - t
            air = sweep(dd, 180, 2600, .45, .9) * np.linspace(.3, 1, len(tv(dd)))
            put(FX, stereo(air), t, .55)
            # altitude counter: ticks whose rate follows the fall
            tk = t; k = 0
            while tk < e['to'] - .05:
                put(FX, X.click(2.2, .12), tk, .35, .6)
                u = (tk - t) / dd; tk += .11 - .07 * np.sin(np.pi * u); k += 1
        elif ty == 'drain_colour':
            put(FX, thud(.25, 62, 1.6), t, .6, 0)
        elif ty == 'touch':
            # the map is torn away: one of the three heaviest sounds in the film (after a suck-out, see main)
            HIT0 = HIT.copy()
            put(HIT, stereo(thud(1.0, 58, 1.6)), t, .55)
            put(HIT, stereo(punch(1.0)), t, 1.0)
            put(HIT, stereo(S.hit('bass_drum', None, 1.0)), t, 1.6)
            put(HIT, stereo(S.hit('gran_cassa', 'hit', 1.0)), t, 1.3)
            put(HIT, stereo(S.hit('clash', 'crash', 1.0)[:int(1.6 * SR)] * np.linspace(1, 0, int(1.6 * SR)) ** 1.5), t, 1.3)
            put(HIT, S.note('timpani', 'D3', 2.0, vel=1.0), t, 1.4, 0)
            # a low brass stab under the slam (D minor, fortissimo, short)
            for n_, v_ in (('D2', 1.0), ('A2', .95), ('D3', .9), ('F3', .85)):
                inst = 'trombone_stac' if mi(n_) >= mi('A#1') else 'tuba_stac'
                put(HIT, stereo(S.note(inst, n_, .5, vel=v_)), t, .9)
            for n_ in ('D3', 'A3', 'F4'):
                put(HIT, stereo(S.note('horn_stac', n_, .5, vel=1.0)), t, .7)
            # the paper rip, swept with the scan bar (0.34 s), crackling
            rd = .42; n = rng.standard_normal(int(rd * SR))
            crackle = (rng.random(len(n)) > .985) * rng.standard_normal(len(n)) * 4
            rip = bpf(n + crackle, 700, 7000) * np.exp(-tv(rd) / .16) * np.minimum(1, tv(rd) / .004)
            put(HIT, np.stack([rip, np.concatenate([np.zeros(240), rip[:-240]])], 1) * 1.6, t - .03, 1.0)
            sand = lpf(rng.standard_normal(int(.7 * SR)), 2500) * np.exp(-tv(.7) / .12)
            put(FX, sand, t + .05, .45, 0)
            HIT[:] = HIT0 + (HIT - HIT0) * 1.25
        elif ty == 'map_drain':
            dd = .8; x = hpf(rng.standard_normal(int(dd * SR)), 2500) * np.exp(-tv(dd) / .25) * np.minimum(1, tv(dd) / .03)
            put(FX, stereo(x * .4), t)
        elif ty == 'silence':
            dd = e['to'] - t
            w = wind(dd + 1.2, 420, 1.0); w *= np.minimum(1, tv(len(w) / SR) / .25); w[-int(.9 * SR):] *= np.linspace(1, 0, int(.9 * SR))
            put(BED, stereo(w * .10), t - .05)
        elif ty == 'rewind':
            # the rewind is built from the film's own last seconds, played backwards and speeding up
            a0 = int((T['touch'] - 1.8) * SR); a1 = int((T['touch'] + .05) * SR)
            src = (MUS[a0:a1] + FX[a0:a1] * .6)[::-1]
            dd = e['to'] - t; nout = int(dd * SR)
            sp = np.linspace(1.0, 3.2, nout) ** 1.0                  # playback speed ramps up (tape spin)
            pos = np.cumsum(sp); pos = pos / pos[-1] * (len(src) - 2)
            out = np.stack([np.interp(pos, np.arange(len(src)), src[:, c]) for c in (0, 1)], 1)
            wob = 1 + .15 * np.sin(2 * np.pi * 7 * tv(dd))[:, None]
            out = out * wob * np.linspace(.55, 1.0, nout)[:, None] ** 1.5
            put(FX, out * .45, t)
            # counter spinning back
            tk = t
            while tk < e['to'] - .03:
                put(FX, X.click(2.6, .14), tk, .35, -.5); tk += .045
        elif ty == 'scan_up':
            put(FX, stereo(sweep(e['dur'], 5200, 900, .3, .5)), t, .45)
        elif ty == 'scan_down':
            put(FX, stereo(sweep(e['dur'], 700, 4200, .3, .5)), t, .5)
        elif ty == 'ring':
            i = e['i']; tones = ['D3', 'C3', 'Bb2', 'A2', 'G2', 'D3']
            v = .62 + .06 * i
            put(HIT, S.note('timpani', tones[i], 1.6, vel=v), t, .8, 0)
            put(HIT, stereo(S.hit('bass_drum', None, .5 + .06 * i)), t, .45 + .05 * i)
            put(HIT, delay(metal_ring(mi(tones[i]) + 24, .55, 2.4), BEAT, .25, 2, 1.0), t)
            pen = hpf(rng.standard_normal(int(.4 * SR)), 4000) * np.exp(-tv(.4) / .12) * .12
            put(FX, pen, t - .02, .6, .2)
            if e['year'] == 1977:
                put(HIT, stereo(thud(.7, 40, 2.2)), t, .45)
        elif ty == 'stop':
            put(HIT, stereo(S.hit('bass_drum', None, 1.0)), t, 1.5)
            put(HIT, S.note('timpani', 'D3', 2.2, vel=1.0), t, 1.5, 0)
            put(HIT, stereo(thud(1.0, 58, 1.8)), t, .55)
            put(HIT, stereo(punch(1.0)), t, 1.05)
            put(HIT, stereo(S.hit('gran_cassa', 'hit', 1.0)), t, 1.0)
            put(HIT, stereo(S.hit('gong2', 'big', .9)[:int(2.5 * SR)] * np.linspace(1, 0, int(2.5 * SR)) ** 1.5), t, .5)
            clang = metal_ring(mi('D3'), .9, 2.0) + bpf(rng.standard_normal(int(2.0 * SR)), 1500, 6000) * np.exp(-tv(2.0) / .04) * .5
            put(HIT, stereo(clang), t, .7)
        elif ty == 'push':
            dd = e['to'] - t; put(FX, stereo(sweep(dd, 300, 1600, .5, .6) * np.linspace(1, .4, len(tv(dd)))), t, .4)
            w = wind(DUR - t, 380, 1.0); w *= np.minimum(1, tv(len(w) / SR) / 1.0)
            ws = int((T['sil2'] + 0.3 - t) * SR); w[ws:] *= 0; fade = int(.5 * SR); w[ws - fade:ws] *= np.linspace(1, 0, fade)
            put(BED, stereo(w * .22), t)
        elif ty == 'horn':
            dd = 2.6; x = saw(hz(mi('A2')), dd, nh=20) + saw(hz(mi('C3')) * 1.003, dd, nh=20) * .8
            x = lpf(x, 700, 2) * adsr(dd, .25, 1.2)
            x = lpf(x, 500) * .5
            put(FX, S.room(stereo(x), .9, .55), t, .32)
            creak = X.creak(.25); put(FX, lpf(creak, 2500), t + 1.4, .25, -.5)
        elif ty == 'label':
            put(FX, X.click(1.0, .45), t, .7, .2); put(FX, delay(ping(mi('A5'), .22, 1.0), BEAT * .5, .3, 2, .7), t)
        elif ty == 'range':
            dd = e['to'] - t; km = e['km']
            # one tick per 2 km of line; the line eases in and out, so do the ticks
            u = np.linspace(0, 1, 4000); g = np.where(u < .5, 4 * u ** 3, 1 - (-2 * u + 2) ** 3 / 2)
            for k in range(1, int(km // 2) + 1):
                f = 2 * k / km; tk = t + np.interp(f, g, u) * dd
                acc = (2 * k) % 10 == 0
                put(FX, X.click(2.0 if acc else 2.6, .42 if acc else .18), tk, .6, -.2)
            whir = bpf(rng.standard_normal(int(dd * SR)), 3000, 7000) * np.sin(np.pi * tv(dd) / dd) * .05
            put(FX, stereo(whir), t)
        elif ty == 'range_end':
            tock = np.sin(2 * np.pi * 330 * tv(.4)) * np.exp(-tv(.4) / .06) + np.sin(2 * np.pi * 660 * tv(.4)) * np.exp(-tv(.4) / .03) * .4
            put(HIT, stereo(tock * .7), t, .9)
            put(HIT, S.note('timpani', 'D3', 1.4, vel=.55), t, .8, 0)
            put(FX, delay(ping(mi('D6'), .3, 1.4), BEAT * .5, .35, 3, .8), t + .02)
        elif ty == 'water_in':
            # the first sound after silence 2: one clear lap of water against a shore, then the bed
            lap = lpf(rng.standard_normal(int(1.1 * SR)), 1400) * np.sin(np.pi * np.clip(tv(1.1) / 1.1, 0, 1)) ** 3
            slap = bpf(rng.standard_normal(int(.25 * SR)), 600, 5000) * np.exp(-tv(.25) / .05) * np.minimum(1, tv(.25) / .01)
            put(FX, stereo(lap * .5), t - .35, 1.0); put(FX, stereo(slap * .45), t, 1.0)
            dd = DUR - t; w = water(dd, 1.0)
            env = np.interp(tv(dd) + t, [t, T['whip'], T['north'], T['dam'], T['pull'], T['pull'] + 3.5, T['end'] + .5],
                            [0, .25, .55, 1.0, 1.0, .35, 0])
            put(BED, stereo(w * env * .42), t)
        elif ty == 'whip':
            dd = e['to'] - t + .15
            put(FX, stereo(sweep(dd, 400, 6000, .5, 1.0) * np.sin(np.pi * tv(dd) / dd)), t - .05, .9)
            put(FX, X.whoosh(dd, .7), t - .05, .5, -.3)
            crack = hpf(rng.standard_normal(int(.09 * SR)), 1800) * np.exp(-tv(.09) / .018)
            put(HIT, stereo(crack * .9), t, 1.0)
        elif ty == 'dam_draw':
            dd = e['to'] - t; x = hpf(rng.standard_normal(int(dd * SR)), 3500) * np.linspace(.2, 1, int(dd * SR)) * .14
            put(FX, x, t, .7, .1)
        elif ty == 'dam':
            put(HIT, stereo(thud(1.0, 58, 1.6)), t, .55)
            put(HIT, stereo(punch(.95)), t, 1.0)
            put(HIT, stereo(S.hit('bass_drum', None, 1.0)), t, 1.4)
            put(HIT, stereo(S.hit('clash', 'short', .8)), t, .6)
            gate = metal_ring(mi('A2'), .8, 1.8)
            put(HIT, stereo(gate), t + .01, .55)
            conc = bpf(rng.standard_normal(int(.35 * SR)), 180, 900) * np.exp(-tv(.35) / .06)
            put(HIT, stereo(conc * .8), t, .9)
            put(HIT, stereo(S.hit('gran_cassa', 'hit', .8)), t, .7)
            knock = bpf(rng.standard_normal(int(.06 * SR)), 700, 4200) * np.exp(-tv(.06) / .01)
            put(HIT, stereo(knock * 1.1), t, 1.0)
            put(HIT, S.note('timpani', 'D3', 1.6, vel=.95), t, 1.3, 0)
        elif ty == 'nring':
            put(HIT, delay(metal_ring(mi('D5'), .3, 2.0), BEAT, .25, 2, .8), t)
            put(HIT, stereo(X.click(1.2, .8)), t, .8)
            put(HIT, S.note('timpani', 'A2', 1.2, vel=.45), t, .7, 0)
            if e['year'] == 2009:
                put(HIT, S.note('timpani', 'D3', 1.6, vel=.5), t, .7, 0)
                put(MUS, stereo(S.note('vibraphone_bowed', 'F#4', 2.4, vel=.5)), t, .5)
        elif ty == 'pull':
            dd = 3.2; put(FX, stereo(sweep(dd, 200, 3000, .5, .8) * np.linspace(.2, 1, int(dd * SR)) ** 1.5 * np.linspace(1, 0, int(dd * SR)) ** .5), t + .3, .4)
        elif ty == 'slide':
            put(FX, X.whoosh(.6, .3), t, .5, .2)
        elif ty == 'pin':
            put(FX, X.click(1.1, .5), t, .8, 0); put(FX, delay(ping(mi('D6'), .4, 1.6), BEAT * .5, .35, 3, .9), t)
        elif ty == 'end':
            put(HIT, stereo(S.hit('bass_drum', None, .8)), t, .55)
            put(HIT, stereo(thud(.8, 40, 2.6)), t, .5)
            put(HIT, stereo(X.click(1.5, .9)), t, .6)
            put(HIT, stereo(S.hit('sus_cymbal', 'stick', .55)), t, .4)
            dd = .7; x = np.sin(2 * np.pi * np.cumsum(700 + 300 * tv(dd) / dd) / SR) * np.sin(np.pi * tv(dd) / dd) ** 2 * .08
            put(FX, x, t, .6, -.2)
        elif ty == 'mark':
            put(FX, X.click(1.6, .35), t, .6, -.3); put(FX, delay(ping(mi('A5'), .16, .8), BEAT * .5, .3, 2, .6), t)
        elif ty == 'pass':
            dd = e['to'] - t; put(FX, stereo(sweep(dd, 3200, 900, .4, .35)), t, .5)
        elif ty == 'lock_echo':
            put(FX, delay(ping(mi('D6'), .45, 2.0), BEAT * .5, .4, 4, 1.0), t)


def voice():
    lines = {L['id']: L for L in TL['VO']}
    for e in EV:
        if e['type'] != 'vo': continue
        p = os.path.join(HERE, 'voice/out', e['id'] + '.wav')
        x, sr = sf.read(p)
        if x.ndim > 1: x = x.mean(1)
        x = soxr.resample(x, sr, SR)
        x = hpf(x, 90)
        x = X.compress(x / (np.abs(x).max() + 1e-9) * .9, thr=.22, ratio=3.2, att=.003, rel=.09)
        x = x + .04 * lpf(x, 3000)   # a little body
        put(VOX, stereo(x, .0002), e['t'])


def rms(x): return float(np.sqrt(np.mean(x ** 2) + 1e-12))


def lufs(x):
    """integrated loudness (EBU R128) measured by ffmpeg"""
    import subprocess, tempfile, re
    f = os.path.join(tempfile.mkdtemp(), 'm.wav'); sf.write(f, x.astype(np.float32), SR)
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1])


def true_peak(x):
    return float(np.abs(soxr.resample(x, SR, 4 * SR)).max())


def tp_limit(x, ceil):
    """look-ahead limiter driven by 4x-oversampled peaks"""
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    up = np.abs(soxr.resample(x, SR, 4 * SR)).max(1)
    n = len(x); pk = up[:n * 4].reshape(-1, 4).max(1) if len(up) >= n * 4 else np.pad(up, (0, n * 4 - len(up))).reshape(-1, 4).max(1)
    g = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    look = int(.004 * SR)
    g = maximum_filter1d(g[::-1], 1)[::-1]
    g = -maximum_filter1d(-g, 2 * look + 1)          # reach the peak early (look-ahead)
    g = uniform_filter1d(g, look)                    # smooth the gain
    g = np.minimum(g, -maximum_filter1d(-np.minimum(1.0, ceil / np.maximum(pk, 1e-9)), 3))
    return x * g[:, None]


def act_rms(x, thr_db=-50):
    """RMS over the parts of a stem that are actually sounding (50 ms windows above thr)"""
    m = x.mean(1) if x.ndim == 2 else x
    w = int(.05 * SR); n = len(m) // w
    r = np.sqrt((m[:n * w].reshape(n, w) ** 2).mean(1))
    on = r > 10 ** (thr_db / 20) * max(r.max(), 1e-9)
    return float(np.sqrt((r[on] ** 2).mean())) if on.any() else 1e-9


def main():
    score(); foley(); voice()
    from scipy.ndimage import uniform_filter1d, maximum_filter1d
    mus = S.room(MUS, .55, .22)
    pul = S.room(PUL, .35, .16)
    hit = S.room(HIT, .7, .25)
    fx = FX.copy(); bed = BED.copy()
    v = np.abs(VOX).mean(1)
    env = uniform_filter1d(maximum_filter1d(v, int(.12 * SR)), int(.15 * SR)); env = np.clip(env / (env.max() + 1e-9) * 3, 0, 1)
    # silences: nothing but the beds inside them (the J-cut water may enter)
    for e in EV:
        if e['type'] == 'silence':
            b = int(e['to'] * SR)
            # music and pulse stop at once; foley and the impact ring on and decay into the silence
            for buf, st, fd in ((mus, .03, .08), (pul, .03, .05), (fx, .25, .3), (hit, .35, .6)):
                a = int((e['t'] + st) * SR); fade = int(fd * SR)
                buf[a:a + fade] *= (np.linspace(1, 0, fade) ** 2)[:, None]; buf[a + fade:b] *= 0
    # suck-outs: music, pulse and foley drop away just before the three heaviest hits (impacts land at b)
    for a_, b_ in ((T['touch'] - .45, T['touch'] - .01), (T['y2025'] - .24, T['y2025'] - .01), (T['dam'] - .22, T['dam'] - .01)):
        i0, i1 = int(a_ * SR), int(b_ * SR); f = int(.06 * SR)
        g = np.ones(N); g[i0:i0 + f] = np.linspace(1, .04, f); g[i0 + f:i1] = .04
        for buf in (mus, pul, fx):
            buf *= g[:, None]
        h = np.ones(N); h[i0:i0 + f] = np.linspace(1, .25, f); h[i0 + f:i1] = .25
        hit *= h[:, None]
    speaking = env > .5
    vr = rms(VOX[speaking])
    # targets relative to the voice (RMS while it speaks / while each stem sounds)
    # stem gains: set once by ear-free targets (music -10 dB under the voice while it speaks, pulse -8, hits about
    # voice level, foley -6, beds -17 against active RMS), then frozen so that individual hits can be shaped by hand
    g_mus, g_pul, g_hit, g_fx, g_bed = 0.15, 0.50, 0.70, 0.42, 0.44
    duck_m = (1 - .45 * env)[:, None]; duck_p = (1 - .3 * env)[:, None]; duck_h = (1 - .25 * env)[:, None]; duck_b = (1 - .3 * env)[:, None]
    stems = {'music': mus * g_mus * duck_m, 'pulse': pul * g_pul * duck_p, 'hits': hit * g_hit * duck_h,
             'fx': fx * g_fx, 'beds': bed * g_bed * duck_b, 'voice': VOX}
    # sub-bass: phones and laptops cannot play below ~60 Hz, and it eats loudness headroom. High-pass at 38 Hz
    # and a -4 dB low shelf below ~55 Hz on everything but the voice; the impacts carry their weight at 60-120 Hz
    shelf = 10 ** (-5 / 20)
    for k in ('music', 'pulse', 'hits', 'beds', 'fx'):
        x = hpf(stems[k], 46 if k == 'hits' else 38, 4 if k == 'hits' else 2)   # drums carry most of the sub: steeper on hits
        stems[k] = x - (1 - shelf) * lpf(x, 62, 2)
    # glue: gentle bus compression on the bed of the mix (music, pulse, foley, beds); voice and hits pass
    # uncompressed so the designed impacts keep their weight; then the master stage below
    from scipy.ndimage import maximum_filter1d as mxf
    bus = stems['music'] + stems['pulse'] + stems['fx'] + stems['beds']
    lvl = np.sqrt(uniform_filter1d((bus ** 2).max(1), int(.012 * SR)))
    thr = 10 ** (-12 / 20) * np.percentile(lvl, 99.9)
    g = np.where(lvl > thr, (thr + (lvl - thr) / 2.5) / np.maximum(lvl, 1e-9), 1.0)
    g = uniform_filter1d(-mxf(-g, int(.008 * SR)), int(.03 * SR))     # fast attack, smooth release
    mix = bus * g[:, None] + stems['hits'] + stems['voice']
    mix = mix[:int(DUR * SR)]
    fade = int(.5 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    # master: bring the mix to about -14.4 LUFS here and hold true peaks under -4.6 dBTP (4x oversampled
    # detection), so mux.sh's loudnorm stays in linear mode and the film lands at -14 LUFS / <= -1.2 dBTP
    for _ in range(3):
        I = lufs(mix)
        mix = mix * 10 ** ((-14.4 - I) / 20)
        mix = tp_limit(mix, 10 ** (-4.6 / 20))
    print(f'master: {lufs(mix):.2f} LUFS, true peak {20 * np.log10(true_peak(mix)):.2f} dBTP')
    os.makedirs(os.path.join(HERE, 'out/stems'), exist_ok=True)
    sf.write(os.path.join(HERE, 'out/mix.wav'), mix.astype(np.float32), SR)
    for name, b in stems.items():
        sf.write(os.path.join(HERE, 'out/stems', name + '.wav'), b[:int(DUR * SR)].astype(np.float32), SR)
    from numpy.fft import rfft, rfftfreq
    m = mix.mean(1); Fq = rfftfreq(len(m), 1 / SR); P = np.abs(rfft(m)) ** 2
    lo = P[(Fq > 20) & (Fq < 120)].sum(); rest = P[(Fq >= 120) & (Fq < 16000)].sum()
    print(f'gains mus {g_mus:.2f} pul {g_pul:.2f} hit {g_hit:.2f} fx {g_fx:.2f} bed {g_bed:.2f}  low/rest {10*np.log10(lo/rest):.1f} dB  peak {np.abs(mix).max():.2f}')


if __name__ == '__main__':
    main()
