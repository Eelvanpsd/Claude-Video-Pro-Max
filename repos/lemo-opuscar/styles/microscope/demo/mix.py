"""Score, sound design and mix for 《量出来的蓝》 Measured Blue -> out/mix.wav (48 kHz stereo) + out/stems/.

Everything sits on the timeline (timeline.json, from timeline.js) and on the page's events (events.json:
every objective change, scan, landing and card), so every sound lands on its frame.

  palette   instrument-clean: hard-mallet vibraphone (16ths / 8ths), marimba ticks, bowed vibraphone and
            water-glass harmonics for the pads and the motif, glockenspiel for each reading that lands,
            a synthesized pulse bass with 2nd/3rd harmonics, timpani / bass drum / gran cassa for the landings
  foley     the objective turret (click + detent + a small metal ring), focus servo, the scan (band-passed
            noise travelling left -> right with counter ticks), pen on glass for each line drawn, the focal
            sweep, whooshes for the truck and the pull, a reversed swell into the end card
  beds      a quiet lab room (fan, a little mains hum, air)
  voice     Kokoro af_heart, compressed, music ducked underneath; two silences (21.8 and 32.3)

usage: $LIB/.venv/bin/python mix.py
"""
import json, os, sys
import numpy as np
import soundfile as sf
import soxr
from scipy.signal import butter, sosfilt
from scipy.ndimage import uniform_filter1d, maximum_filter1d

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB') or os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, LIB)
from core.audio import sampler as S
from core.audio import sfx as X

SR = X.SR
TL = json.load(open(os.path.join(HERE, 'timeline.json')))
EV = json.load(open(os.path.join(HERE, 'events.json')))['ev']
T = TL['T']
DUR = TL['dur']
N = int((DUR + 0.8) * SR)
BEAT = 60 / TL['bpm']; BAR = 4 * BEAT
rng = np.random.default_rng(31)
S.seed(9)
MUS = np.zeros((N, 2)); PUL = np.zeros((N, 2)); HIT = np.zeros((N, 2)); FX = np.zeros((N, 2)); BED = np.zeros((N, 2)); VOX = np.zeros((N, 2))


# ------------------------------------------------------------------ dsp helpers
def sos(kind, f, o=2): return butter(o, f, kind, fs=SR, output='sos')
def lpf(x, f, o=2): return sosfilt(sos('low', min(f, SR * .45), o), x, axis=0)
def hpf(x, f, o=2): return sosfilt(sos('high', f, o), x, axis=0)
def bpf(x, a, b, o=2): return sosfilt(sos('band', [a, min(b, SR * .45)], o), x, axis=0)
def tv(d): return np.arange(int(d * SR)) / SR
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
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
def adsr(d, a=.005, r=.1):
    n = int(d * SR); e = np.ones(n)
    na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    nr = min(n, int(r * SR)); e[n - nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e
def saw(f, d, det=0.0, nh=30):
    t = tv(d); x = np.zeros_like(t)
    for k in range(1, nh):
        if f * k > 14000: break
        x += np.sin(2 * np.pi * f * (1 + det) * k * t) / k
    return x * .55
def rms(x): return float(np.sqrt(np.mean(np.square(x)))) + 1e-12
def sustain(name, m, d, vel, rel=None):
    return S.note(name, int(m), d, vel=vel, **({'release': rel} if rel else {}))


# ------------------------------------------------------------------ harmony: one chord per bar (90 BPM)
CH = {   # root (bass, MIDI) and upper voicing
    'Dsus2': (38, ['D4', 'E4', 'A4', 'D5']), 'Bm7': (35, ['D4', 'F#4', 'A4', 'B4']), 'Gmaj7': (31, ['D4', 'F#4', 'G4', 'B4']),
    'Asus4': (33, ['D4', 'E4', 'A4', 'B4']), 'Em9': (40, ['D4', 'F#4', 'G4', 'B4']), 'D': (38, ['D4', 'F#4', 'A4', 'D5']),
    'Bm': (35, ['D4', 'F#4', 'B4', 'D5']), 'A': (33, ['C#4', 'E4', 'A4', 'C#5']),
}
PROG = ['Dsus2', 'Bm7', 'Gmaj7', 'Asus4', 'Dsus2', 'Bm7', 'Gmaj7', 'Asus4', 'Bm', 'Gmaj7', 'Em9', 'D', 'Gmaj7', 'Dsus2', 'D']
def chord_at(t): return CH[PROG[min(len(PROG) - 1, int(t // BAR))]]


def bass(m, d, vel=.8, cut=420):
    f = hz(m); x = saw(f, d, nh=16) * .7 + np.sin(2 * np.pi * f * tv(d)) * .9
    x = lpf(x, cut) + .14 * np.tanh(3 * lpf(x, 900))           # 2nd/3rd harmonics speak on small speakers
    return x * adsr(d, .01, min(.2, d * .45)) * vel


def score():
    nb = len(PROG)
    for b in range(nb):
        t0 = b * BAR
        if t0 >= DUR: break
        root, voic = CH[PROG[b]]
        sec = section(t0)
        # pads: bowed vibraphone (upper voices) + a soft glass shimmer on the top note
        if sec not in ('silent',):
            pv = .32 if sec in ('measure', 'hold') else .4
            for k, n in enumerate(voic[1:]):
                put(MUS, sustain('vibraphone_bowed', mi(n), BAR + .3, pv, rel=.8), t0, .55, -.4 + .4 * k)
        # pulse bass: 8ths (push / dive), quarters (measure), long notes (open, hold, card)
        if sec in ('push', 'dive'):
            for i in range(8): put(PUL, bass(root, BEAT / 2 * .9, .55 + .25 * (i % 2 == 0)), t0 + i * BEAT / 2)
        elif sec in ('measure', 'hold'):
            for i in range(4): put(PUL, bass(root, BEAT * .8, .5), t0 + i * BEAT)
        elif sec in ('open', 'card', 'land'):
            put(PUL, bass(root, BAR * .95, .55, 300), t0)
        # vibraphone patterns
        pat = [mi(n) for n in voic] + [mi(voic[1]) + 12]
        if sec in ('push', 'dive'):
            for i in range(16):
                m = pat[(i * 3) % len(pat)] + (12 if i % 8 == 7 else 0)
                put(MUS, S.note('vibraphone_hard', m, .25, vel=.42 + .2 * ((i % 4) == 0)), t0 + i * BEAT / 4, .55, .3 * np.sin(i))
        elif sec == 'measure':
            for i in range(8):
                put(MUS, S.note('vibraphone_hard', pat[(i * 2) % len(pat)], .4, vel=.34), t0 + i * BEAT / 2, .45, -.3 + .6 * (i % 2))
        elif sec in ('open', 'card'):
            for i, n in enumerate(voic):
                put(MUS, S.note('vibraphone', mi(n) + 12, 1.6, vel=.36), t0 + i * BEAT, .45, -.3 + .2 * i)
        # marimba ticks on the off-beats while measuring
        if sec == 'measure':
            for i in range(4): put(MUS, S.note('marimba', mi(voic[0]) + 12, .2, vel=.28), t0 + i * BEAT + BEAT / 2, .35, .5)
    # the glass motif when the nucleus lands (D major), with echoes
    for i, (n, dt) in enumerate([('D5', 0), ('A4', .5), ('F#5', 1.0), ('E5', 1.5), ('D5', 2.25)]):
        for k in range(3):
            put(MUS, S.note('glass', mi(n), 1.6, vel=.55 * .5 ** k), T['land'] + dt * BEAT + k * .375, .9, (-.4, .4, 0)[k])
    # the end card: motif once more, slower, and a long low D
    for i, (n, dt) in enumerate([('A4', 0), ('D5', 1), ('F#5', 2), ('E5', 3), ('D5', 4.5)]):
        put(MUS, S.note('glass', mi(n), 2.4, vel=.5), T['card'] + .1 + dt * BEAT, .9, -.2 + .1 * i)
    put(MUS, sustain('vibraphone_bowed', mi('D4'), 4.0, .4, rel=1.5), T['card'], .7, 0)
    put(PUL, bass(38, 4.2, .6, 260), T['card'])


def section(t):
    if t < T['push']: return 'open'
    if t < T['tissue']: return 'push'
    if t < T['circA']: return 'push' if t >= T['toA'] - .01 else 'hold'
    if t < T['both']: return 'measure'
    if t < T['dive']: return 'hold'
    if t < T['land']: return 'dive'
    if t < T['card']: return 'land'
    return 'card'


# ------------------------------------------------------------------ foley
def noise(d): return rng.standard_normal(int(d * SR))
def objective_click(up=True):
    d = .5; t = tv(d)
    c1 = hpf(noise(.012), 1800) * np.exp(-tv(.012) / .002)
    c2 = bpf(noise(.03), 600, 3000) * np.exp(-tv(.03) / .006) * .7
    ring = sum(a * np.sin(2 * np.pi * f * (1.03 if up else .97) * t) * np.exp(-t / tau)
               for f, a, tau in ((2140, .5, .06), (3420, .35, .045), (5230, .2, .03)))
    x = np.zeros(int(d * SR)); x[:len(c1)] += c1; s = int(.038 * SR); x[s:s + len(c2)] += c2; x += ring * .25
    # the focus servo answering the change
    st = int(.07 * SR); sv = tv(.16); f0 = 820 if up else 1100
    whine = np.sin(2 * np.pi * (f0 + 500 * sv / .16 * (1 if up else -1)) * sv) * np.sin(np.pi * sv / .16) ** 2 * .05
    x[st:st + len(whine)] += whine
    return x * .8
def pen(d, v=1.0):
    x = bpf(noise(d), 2500, 9000) * (0.6 + 0.4 * np.abs(np.sin(np.pi * tv(d) * 23)))
    return x * adsr(d, .03, .1) * .16 * v
def scan(d):
    t = tv(d); x = noise(d); y = np.zeros_like(x)
    for i in range(0, len(x), 2048):                              # band-pass that rises with the front
        fc = 1800 + 3200 * (i / len(x)); seg_ = x[i:i + 2048]
        y[i:i + 2048] = bpf(seg_, fc * .7, fc * 1.4)
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** .6
    return y * env * .14
def whoosh(d, v=1.0, rev=False):
    t = tv(d); x = noise(d); env = np.sin(np.pi * t / d) ** 2
    y = np.zeros_like(x)
    for i in range(0, len(x), 2048):
        fc = 300 + 2400 * np.sin(np.pi * i / len(x)); y[i:i + 2048] = bpf(x[i:i + 2048], fc * .6, fc * 1.6)
    y = y * env * .25 * v
    return y[::-1] if rev else y
def riser(d, v=1.0):
    t = tv(d); f = 300 * 2 ** (2.5 * t / d)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * .25 + hpf(noise(d), 2000) * .15
    return x * (t / d) ** 2 * v * .5


def foley():
    for e in EV:
        t = e['t']; ty = e['type']
        if ty == 'objective':
            put(FX, objective_click(e['up']), t, .9 if t < T['pull'] else .6, .25 if e['up'] else -.25)
        elif ty in ('circle', 'ring'):
            put(FX, pen(.36), t, .9, 0)
        elif ty == 'dimension':
            put(FX, pen(.65, .8), t + .05, .9, -.2)
        elif ty == 'scan':
            d = e['dur']; x = scan(d)
            n = len(x); pan = np.linspace(-.7, .7, n)
            st = np.stack([x * np.cos((pan + 1) * np.pi / 4), x * np.sin((pan + 1) * np.pi / 4)], 1) * 1.414
            put(FX, st, t, 1.0)
            # counter ticks: faster as the count climbs
            k = 0; tt = 0.0
            while tt < d:
                put(FX, X.click(1.6, .25), t + tt, .35, -.6 + 1.2 * tt / d); k += 1; tt += .11 * (1 - .6 * tt / d)
        elif ty == 'land':
            m = mi('A5') if e['v'] < .2 else mi('D6')
            put(HIT, S.note('glockenspiel', m, 1.5, vel=.6), t, .8, .1)
            put(HIT, S.hit('timpani', 'drum2', .45), t, .55, 0)
        elif ty == 'truck':
            put(FX, whoosh(1.3, .8), t, 1.0, 0)
        elif ty == 'verdict':
            put(HIT, S.hit('timpani', 'drum1', .75), t, .9, 0)
            put(HIT, S.hit('gran_cassa', 'hit', .55), t, .6, 0)
            put(HIT, S.note('glockenspiel', mi('B5'), 1.8, vel=.5), t, .6, 0)
            put(PUL, bass(35, 3.6, .7, 300), t)
        elif ty in ('push', 'dive'):
            put(FX, riser(2.6 if ty == 'dive' else 2.5), t + .05, .8, 0)
        elif ty == 'sweep':
            d = e['dur']; x = bpf(noise(d), 1200, 7000) * np.sin(np.pi * tv(d) / d) ** 1.5 * .09
            n = len(x); pan = np.linspace(-.8, .8, n)
            put(FX, np.stack([x * np.cos((pan + 1) * np.pi / 4), x * np.sin((pan + 1) * np.pi / 4)], 1) * 1.414, t, 1.0)
        elif ty == 'landN':
            put(HIT, S.note('glockenspiel', mi('F#6'), 1.4, vel=.5), t, .7, .1)
        elif ty == 'pull':
            put(FX, whoosh(2.6, 1.2, rev=False), t, 1.0, 0)
        elif ty == 'card':
            sw = whoosh(1.0, .9, rev=True); put(FX, sw, t - 1.0, .8, 0)
            put(HIT, S.hit('bass_drum', None, .5), t, .6, 0)
            put(HIT, S.hit('sus_cymbal', 'bow', .3), t, .25, 0)
    # the opening: a light glass shimmer as the light moves over the slide
    sh = sum(np.sin(2 * np.pi * f * tv(2.6)) * a for f, a in ((3520, .5), (4186, .35), (5274, .2)))
    put(FX, sh * np.sin(np.pi * tv(2.6) / 2.6) ** 2 * .02, .2, 1.0, 0)
    put(HIT, S.hit('timpani', 'drum2', .3), 0.02, .4, 0)


def beds():
    d = N / SR
    fan = lpf(noise(d), 380) * .05 + bpf(noise(d), 900, 2400) * .006
    hum = (np.sin(2 * np.pi * 100 * tv(d)) * .004 + np.sin(2 * np.pi * 150 * tv(d)) * .002)
    x = (fan + hum)[:N]
    BED[:, 0] += x; BED[:, 1] += np.roll(x, 311)


def voice():
    for L in TL['VO']:
        x, sr = sf.read(os.path.join(HERE, 'voice/out', L['id'] + '.wav'), dtype='float64')
        if x.ndim > 1: x = x.mean(1)
        x = soxr.resample(x, sr, SR)
        x = hpf(x, 90)
        x = X.compress(x / (np.abs(x).max() + 1e-9) * .8, thr=.22, ratio=3.0)
        put(VOX, x, L['t'], 1.0, 0)


def lufs_like(x):
    # K-weighting approximation: high-shelf + high-pass, then mean square over 400 ms gated blocks
    y = hpf(x, 60) ; y = y + .58 * hpf(y, 1500)
    w = int(.4 * SR); n = len(y) // w
    ms = (y[:n * w].reshape(n, w, -1) ** 2).mean((1, 2))
    ms = ms[ms > 10 ** (-70 / 10)]
    rel = ms[ms > ms.mean() * 10 ** (-10 / 10)]
    return -0.691 + 10 * np.log10(rel.mean() + 1e-12)


def main():
    score(); foley(); beds(); voice()
    mus = S.room(MUS, .55, .2); pul = PUL.copy(); hit = S.room(HIT, .6, .22); fx = S.room(FX, .3, .12); bed = BED.copy()
    v = np.abs(VOX).mean(1)
    env = uniform_filter1d(maximum_filter1d(v, int(.12 * SR)), int(.18 * SR)); env = np.clip(env / (env.max() + 1e-9) * 3, 0, 1)
    # the two silences: music, pulse and foley drop away; only the room stays
    for a_, b_ in ((T['hush1'], T['verdict'] - .01), (T['hush2'], T['pull'] - .01)):
        i0, i1 = int(a_ * SR), int(b_ * SR); f = int(.08 * SR)
        g = np.ones(N); g[i0:i0 + f] = np.linspace(1, .05, f); g[i0 + f:i1] = .05
        for buf in (mus, pul, fx, hit): buf *= g[:, None]
    speaking = env > .5
    vr = rms(VOX[speaking])
    def act(x):
        m = np.abs(x).mean(1); w = int(.05 * SR); n = len(m) // w; r = np.sqrt((m[:n * w].reshape(n, w) ** 2).mean(1))
        on = r > 10 ** (-40 / 20) * r.max(); return float(np.sqrt((r[on] ** 2).mean()))
    # stem levels against the voice (dB, active RMS): music -11, pulse -14, foley -12, hits -6, room -30
    tg = {'music': -11, 'pulse': -14, 'fx': -12, 'hits': -6, 'beds': -30}
    stems = {}
    for k, x in (('music', mus), ('pulse', pul), ('fx', fx), ('hits', hit), ('beds', bed)):
        stems[k] = x * (vr * 10 ** (tg[k] / 20) / act(x))
    stems['music'] *= (1 - .4 * env)[:, None]; stems['pulse'] *= (1 - .3 * env)[:, None]
    stems['voice'] = VOX
    shelf = 10 ** (-4 / 20)
    for k in ('music', 'pulse', 'hits', 'beds', 'fx'):
        x = hpf(stems[k], 38, 2); stems[k] = x - (1 - shelf) * lpf(x, 62, 2)
    bus = stems['music'] + stems['pulse'] + stems['fx'] + stems['beds']
    lvl = np.sqrt(uniform_filter1d((bus ** 2).max(1), int(.012 * SR)))
    thr = 10 ** (-10 / 20) * np.percentile(lvl, 99.9)
    g = np.where(lvl > thr, (thr + (lvl - thr) / 2.5) / np.maximum(lvl, 1e-9), 1.0)
    g = uniform_filter1d(-maximum_filter1d(-g, int(.008 * SR)), int(.03 * SR))
    mix = bus * g[:, None] + stems['hits'] + stems['voice']
    mix = mix[:int(DUR * SR)]
    fade = int(1.2 * SR); mix[-fade:] *= (np.linspace(1, 0, fade) ** 1.5)[:, None]
    I = lufs_like(mix); mix *= 10 ** ((-15.0 - I) / 20)
    pk = np.abs(mix).max()
    if pk > .7: mix = np.stack([X.limit(mix[:, 0], .7), X.limit(mix[:, 1], .7)], 1)
    os.makedirs(os.path.join(HERE, 'out/stems'), exist_ok=True)
    sf.write(os.path.join(HERE, 'out/mix.wav'), mix.astype(np.float32), SR)
    for name, b in stems.items():
        sf.write(os.path.join(HERE, 'out/stems', name + '.wav'), b[:int(DUR * SR)].astype(np.float32), SR)
    from numpy.fft import rfft, rfftfreq
    m = mix.mean(1); Fq = rfftfreq(len(m), 1 / SR); Pw = np.abs(rfft(m)) ** 2
    lo = Pw[(Fq > 20) & (Fq < 120)].sum(); rest = Pw[(Fq >= 120) & (Fq < 16000)].sum()
    print(f'mix: approx {lufs_like(mix):.1f} LUFS, peak {np.abs(mix).max():.2f}, low/rest {10 * np.log10(lo / rest):.1f} dB')


if __name__ == '__main__':
    main()
