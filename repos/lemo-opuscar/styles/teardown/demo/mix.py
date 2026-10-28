"""《二十一键》 score, foley, voice and mix -> out/mix.wav (+ out/stems/).
96 BPM in D: a mallet-and-pulse groove (marimba, electric bass, synth kick, claves, hi-hat) for the outside of the object,
bowed vibraphone, glass and a sub heartbeat for the inside, D major on the end card. Foley is synthesised and placed
from events.json (window.EV); the voice is Kokoro (voice/out). Run from anywhere: python demo/mix.py
"""
import os, sys, json
import numpy as np, soundfile as sf, soxr
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB') or os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, LIB)
from core.audio import sampler as S
from core.audio.sfx import SR, add, noise, lp, hp, bp, env_exp, t_, norm, compress, limit

S.seed(21)
EVJ = json.load(open(os.path.join(HERE, 'events.json')))
DUR = EVJ['dur']; EV = EVJ['ev']
TL = json.load(open(os.path.join(HERE, 'timeline.json')))
T, VO, BPM = TL['T'], TL['VO'], TL['BPM']
BEAT = 60 / BPM; BAR = 4 * BEAT
N = int((DUR + 1.5) * SR)
def buf(): return np.zeros((N, 2), np.float32)
def b(bar, beat=0): return (bar - 1) * BAR + beat * BEAT
rng = np.random.default_rng(5)

# ---------------- score ----------------
CH = [['D3', 'F3', 'A3', 'C4', 'E4'], ['A#2', 'D3', 'F3', 'A3', 'C4'], ['F2', 'A2', 'C3', 'E3', 'G3'], ['C3', 'E3', 'G3', 'B3', 'D4']]
ROOT = ['D2', 'A#1', 'F1', 'C2']
def up(p, n): return S.name(S.midi(p) + 12 * n)
ev = []          # sampled notes: (t, inst, pitch, dur, vel, pan, gain)
kick_t = []      # synth kick times (with gain)
def sec(t, a, z): return a <= t < z

for bar in range(1, 17):
    t0 = b(bar); c = CH[(bar - 1) % 4]; r = ROOT[(bar - 1) % 4]
    # A · hero (bars 1–2): marimba in 8ths, soft, thinning before the suck-out
    if bar <= 2:
        for i in range(8):
            t = t0 + i * BEAT / 2
            if t >= T['suck'] - .05: break
            ev.append((t, 'marimba', up(c[(i * 2) % 5], 1), .4, .34 + .08 * (i % 2 == 0), -.25 + .5 * (i % 2), 1.7))
        ev.append((t0, 'vibraphone_bowed', up(c[2], 1), BAR * .95, .38, .2, 1.0))
    # B · explode and labels (bars 3–5): full groove
    if 3 <= bar <= 5:
        for i in range(16):
            t = t0 + i * BEAT / 4
            p = up(c[[0, 2, 4, 2, 1, 3, 4, 3][i % 8]], 1 + (i % 8 == 2))
            ev.append((t, 'marimba', p, .3, .42 + .2 * (i % 4 == 0), [-.35, .35][i % 2], .9))
        for k in (0, 1.5, 2, 3, 3.5): ev.append((t0 + k * BEAT, 'electric_bass', r, BEAT * .9, .7, 0, 1.1))
        for k in (0, 2): kick_t.append((t0 + k * BEAT, 1.0))
        for k in (1, 3): ev.append((t0 + k * BEAT, 'claves', None, None, .5, .2, .55))
        for i in range(16): ev.append((t0 + i * BEAT / 4, 'hihat', 'closed', None, .25 + .15 * (i % 2 == 0), -.3, .35))
    # C · inside the object (bars 6–10): bowed vibraphone, glass, sub heartbeat, a slow tick
    if 6 <= bar <= 10:
        for j, p in enumerate(c[1:4]): ev.append((t0 + j * .05, 'vibraphone_bowed', up(p, 1), BAR * 1.02, .42, -.4 + .4 * j, .75))
        for k in range(8):
            t = t0 + k * BEAT / 2
            if t < b(10, 3): ev.append((t, 'hihat', 'pedal', None, .2, .35, .22))
        if t0 + BAR <= b(10, 3) + .01: kick_t.append((t0, .55))
        motif = [(0, 4), (1.5, 2), (2.5, 3)]
        for k, idx in motif:
            if t0 + k * BEAT < b(10, 3): ev.append((t0 + k * BEAT, 'glass', up(c[idx], 2 if idx < 3 else 1), 1.2, .38, .3 - .3 * k / 3, .5))
    # D · back together and the dimensions (bars 11–14, beat 2): groove returns, four on the floor
    if 11 <= bar <= 14:
        end = T['card']
        for i in range(16):
            t = t0 + i * BEAT / 4
            if t >= end - .02: break
            p = up(c[[0, 2, 4, 2, 1, 3, 4, 3][i % 8]], 1 + (i % 8 == 2))
            ev.append((t, 'marimba', p, .3, .44 + .2 * (i % 4 == 0), [-.35, .35][i % 2], .95))
            ev.append((t, 'hihat', 'closed', None, .28 + .15 * (i % 2 == 0), -.3, .38))
        for k in (0, 1.5, 2, 3, 3.5):
            if t0 + k * BEAT < end - .02: ev.append((t0 + k * BEAT, 'electric_bass', r, BEAT * .9, .72, 0, 1.15))
        for k in (0, 1, 2, 3):
            if t0 + k * BEAT < end - .02: kick_t.append((t0 + k * BEAT, .9))
        for k in (1, 3):
            if t0 + k * BEAT < end - .02: ev.append((t0 + k * BEAT, 'claves', None, None, .55, .2, .55))

# E · end card (D major): one hit, a rolled chord, the glass motif answering the opening
tc = T['card']
kick_t.append((tc, 1.2))
for j, p in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']): ev.append((tc + j * .045, 'marimba', p, 2.5, .62, -.5 + .2 * j, 1.0))
for p in ['D4', 'F#4', 'A4']: ev.append((tc, 'vibraphone_bowed', p, 4.4, .45, 0, .8))
ev.append((tc, 'electric_bass', 'D2', 3.0, .75, 0, 1.0))
for k, p in [(1.0, 'A5'), (1.5, 'F#5'), (2.0, 'D6')]: ev.append((tc + k * BEAT * 2, 'glockenspiel', p, 2, .4, .25, .45))
# stops: one glockenspiel ping per macro stop (rising: D6, F#6 is not in the bar's chord, so A5 → D6 → E6)
for e in EV:
    if e['type'] == 'stop': ev.append((e['t'], 'glockenspiel', ['A5', 'D6', 'E6'][e['n']], 2, .5, .15, .6))
    if e['type'] == 'ledOn':
        for i, p in enumerate(['D6', 'F6', 'A6', 'C7', 'E7']): ev.append((e['t'] + i * .07, 'glockenspiel', p, 1.5, .3, -.4 + .2 * i, .35))

music = S.render([e for e in ev if e[0] < DUR], dur=N / SR, master=False)
music = np.asarray(music, np.float32)
if len(music) < N: music = np.pad(music, ((0, N - len(music)), (0, 0)))
music = music[:N]

def kick(v=1.0):
    d = .45; tt = t_(d); f = 54 + 90 * np.exp(-tt / .035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * env_exp(d, .16) + np.sin(2 * ph) * .25 * env_exp(d, .05) + hp(noise(d), 3000) * env_exp(d, .003) * .25
    return norm(x) * v
pulse = buf()
for t, v in kick_t: add(pulse, kick(v), t, .55)

# ---------------- foley ----------------
fol = buf()
def plastic(p=1.0, v=1.0, d=.07):          # keycap: hollow PBT clack
    tt = t_(d); pp = p * (.92 + rng.random() * .16)
    x = hp(noise(d), 1500) * env_exp(d, .0025) * .7
    x += sum(a * np.sin(2 * np.pi * f * pp * tt + rng.random() * 6) * env_exp(d, tau) for f, a, tau in [(1050, .7, .014), (2350, .45, .009), (620, .5, .02), (3900, .2, .005)])
    return norm(x) * v
def switch_click(v=1.0):                    # switch bottoming out: small click + low thock
    d = .12; tt = t_(d)
    x = hp(noise(d), 4000) * env_exp(d, .0012) + np.sin(2 * np.pi * 3400 * tt) * env_exp(d, .004) * .4
    x += np.sin(2 * np.pi * 240 * tt) * env_exp(d, .022) * .9 + lp(noise(d), 900) * env_exp(d, .01) * .5
    return norm(x) * v
def metal(f=2400, v=1.0, d=.9):            # small machined part: inharmonic ring
    tt = t_(d)
    x = sum(a * np.sin(2 * np.pi * f * k * tt) * env_exp(d, tau) for k, a, tau in [(1, 1, .35), (2.76, .5, .18), (5.4, .25, .09), (8.9, .12, .05)])
    return norm(x + hp(noise(d), 5000) * env_exp(d, .002) * .6) * v
def board(v=1.0):                           # FR-4 sheet: dry tock
    d = .18; tt = t_(d)
    x = bp(noise(d), 500, 2500) * env_exp(d, .012) + np.sin(2 * np.pi * 380 * tt) * env_exp(d, .03) * .6
    return norm(x) * v
def thud(v=1.0):
    d = .4; tt = t_(d)
    return norm(np.sin(2 * np.pi * 72 * tt * (1 - .2 * tt)) * env_exp(d, .09) + lp(noise(d), 400) * env_exp(d, .025) * .6) * v
def swoosh(d=.6, v=1.0, rise=True):
    n = noise(d); out = np.zeros_like(n); tt = t_(d)
    for i in range(0, len(n), 480):
        hi = min(len(n), i + 480); u = i / len(n); u = u if rise else 1 - u
        f = 300 + 3600 * u ** 1.5; seg_ = bp(n[max(0, i - 2400):hi], f * .6, f * 1.4)[-(hi - i):]; out[i:hi] = seg_
    e = np.sin(np.pi * tt / d) ** 1.5
    return norm(out * e) * v
def tick(v=1.0, f=5200):
    d = .03; tt = t_(d); return norm(np.sin(2 * np.pi * f * tt) * env_exp(d, .003) + hp(noise(d), 6000) * env_exp(d, .001) * .4) * v
def pen(v=1.0, d=.5):                       # a dimension line being drawn: fine-tip hiss
    tt = t_(d); return norm(bp(noise(d), 3000, 9000) * np.sin(np.pi * tt / d) ** 2 * (1 + .3 * np.sin(2 * np.pi * 31 * tt))) * v
def suck(d=.6):
    tt = t_(d); x = lp(noise(d), 2500) * (tt / d) ** 3
    return norm(x) * .5

for e in EV:
    t, ty = e['t'], e['type']
    if ty == 'tap': add(fol, switch_click(1), t, .55, .3)
    elif ty == 'tapUp': add(fol, plastic(1.1, .6), t, .3, .3)
    elif ty == 'suck': add(fol, suck(.6), t, .18)
    elif ty == 'capUp': add(fol, plastic(1.5, .5, .04), t, .12, e.get('pan', 0) * .7)
    elif ty == 'launch':
        g = {'sw': .16, 'plate': .22, 'pcb': .18, 'spacer': .12, 'case': .2}[e['layer']]
        add(fol, swoosh(.5, 1, True), t - .05, g, 0)
        if e['layer'] == 'spacer': add(fol, metal(3100, 1, .7), t + .2, .1, .2)
        if e['layer'] == 'case': add(fol, thud(.8), t, .25)
    elif ty == 'capLand': add(fol, plastic(.95, 1), t, .28, e.get('pan', 0) * .8); add(fol, switch_click(.5), t + .01, .1, e.get('pan', 0) * .8)
    elif ty == 'land':
        L = e['layer']
        if L == 'case': add(fol, thud(1), t, .4)
        elif L == 'spacer': add(fol, metal(2700, 1, .6), t, .12, -.2)
        elif L in ('pcb', 'plate'): add(fol, board(1), t, .35, .1 if L == 'pcb' else -.1)
        elif L == 'sw': add(fol, switch_click(1), t, .3)
    elif ty == 'label': add(fol, tick(1, 4800 + 300 * (len(e.get('id', '')) % 5)), t, .07, .5)
    elif ty == 'dim': add(fol, pen(1, .55), t, .09, .3); add(fol, tick(1, 6000), t + .55, .06, .3)
    elif ty == 'gap': add(fol, swoosh(1.2, 1, True), t, .12)
    elif ty == 'dive': add(fol, swoosh(1.6, 1, False), t - .35, .26)          # starts before the cut it belongs to
    elif ty == 'travel': add(fol, swoosh(1.1, 1, True), t - .1, .22)
    elif ty == 'pull': add(fol, swoosh(1.3, 1, False), t, .3); add(fol, thud(.7), t, .3)
    elif ty == 'card': add(fol, thud(1), t, .3)
# the explode hit: first sound after silence 1
add(fol, thud(1.2), T['explode'], .55); add(fol, metal(1800, 1, 1.4), T['explode'], .1, -.3)
# room tone: a quiet, slightly warm bed under everything (lifted inside the object)
bed = lp(np.cumsum(noise(N / SR)) * .002, 300); bed -= np.convolve(bed, np.ones(4800) / 4800, 'same'); bed = norm(bed) * .5
hum = np.sin(2 * np.pi * 50 * np.arange(N) / SR) * .15 + np.sin(2 * np.pi * 100 * np.arange(N) / SR) * .06
tt = np.arange(N) / SR
inside = np.clip((tt - T['dive'] + .5) / .8, 0, 1) * np.clip((T['pullOut'] - tt) / .6, 0, 1)
bedmix = (bed * (.02 + .03 * inside) + hum * .004 * inside)[:, None] * np.ones((1, 2))

# ---------------- silences ----------------
def gate(a, z, fade=.12):
    g = np.ones(N, np.float32)
    i0, i1, f = int(a * SR), int(z * SR), int(fade * SR)
    g[i0:i1] = 0; g[max(0, i0 - f):i0] *= np.linspace(1, 0, min(f, i0)); g[i1:i1 + f] *= np.linspace(0, 1, f)
    return g[:, None]
sil = gate(T['suck'] + .05, T['explode'] - .01) * gate(b(10, 3) + .2, T['pullOut'] - .01)
music *= sil; pulse *= sil

# ---------------- voice ----------------
voice = buf()
for v in VO:
    x, sr = sf.read(os.path.join(HERE, 'voice/out', v['id'] + '.wav'), dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    if sr != SR: x = soxr.resample(x, sr, SR)
    x = hp(x, 80); x = compress(x / (np.abs(x).max() + 1e-9) * .9, thr=.22, ratio=3.0)
    add(voice, x, v['t'], .5, 0)
venv = np.abs(voice).mean(1)
from scipy.ndimage import uniform_filter1d, maximum_filter1d
venv = uniform_filter1d(maximum_filter1d(venv, int(.25 * SR)), int(.2 * SR))
duck = 1 - .55 * np.clip(venv / (venv.max() + 1e-9) * 4, 0, 1)

def rms(x): return float(np.sqrt(np.mean(x ** 2)) + 1e-12)
mus = music * .9 + pulse
mus[:, 0] = hp(mus[:, 0], 44, 4); mus[:, 1] = hp(mus[:, 1], 44, 4)
for c in range(2): fol[:, c] = hp(fol[:, c], 36, 2)
mus *= duck[:, None]
mix = voice * 1.0 + mus * .42 + fol * .9 + bedmix
for c in range(2): mix[:, c] = limit(mix[:, c], .92)
os.makedirs(os.path.join(HERE, 'out/stems'), exist_ok=True)
end = int(DUR * SR); tail = int(.6 * SR)
mix = mix[:end]; mix[-tail:] *= np.linspace(1, 0, tail)[:, None] ** 2
sf.write(os.path.join(HERE, 'out/mix.wav'), mix, SR, subtype='PCM_24')
for nm, x in [('voice', voice), ('music', mus * .42), ('foley', fol * .9)]: sf.write(os.path.join(HERE, f'out/stems/{nm}.wav'), x[:end], SR, subtype='PCM_24')
v_on = venv[:end] > venv.max() * .05
print(f'mix {DUR:.2f}s  voice rms {20*np.log10(rms(voice[:end][v_on])):.1f} dBFS  music rms {20*np.log10(rms((mus*.42)[:end])):.1f}  foley rms {20*np.log10(rms((fol*.9)[:end])):.1f}  peak {np.abs(mix).max():.2f}')
