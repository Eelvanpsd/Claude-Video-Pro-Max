"""Score, foley, beds and voice for 《差两秒》 -> out/mix.wav (+ out/stems/*.wav).
Reads out/timeline.json (tools/export.mjs) and voice/out/*.wav. Run from anywhere: python mix.py
Score: 90 BPM, B minor -> D major. Felt piano (Salamander), strings (VSCO 2 CE), glass and bowed vibraphone (VCSL)
for the loupe and the readings; contrabass only on the arrival chord. Foley: light-table ballast hum and starter,
the loupe on glass, paper, the measuring ticks, a pen stroke for the verdict. Beds: hum on the table, wind and surf
inside the photographs."""
import sys, os, json
import numpy as np, soundfile as sf, soxr
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB') or os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, LIB)
from core.audio import sampler as S
from core.audio.sfx import SR, add, noise, bp, lp, hp, env_exp, t_, norm, compress, clack, whoosh, thump, brown

TL = json.load(open(os.path.join(HERE, 'out', 'timeline.json')))
HIT, BEAT, DUR = TL['hit'], TL['beat'], TL['dur']
N = int((DUR + 0.5) * SR)
S.seed(11)
rng = np.random.default_rng(5)
st = lambda: np.zeros((N, 2), np.float32)
music, foley, beds, voice = st(), st(), st(), st()
b = lambda n: n * BEAT


def seg(t, a, c): return np.clip((t - a) / (c - a), 0, 1)
tt = np.arange(N) / SR


# ---------------- score ----------------
EV = []
def P(t, pitch, dur, vel, pan=0.0, inst='piano', gain=1.0): EV.append((t, inst, pitch, dur, vel, pan, gain))

# A. telegram (bars from beat 1): Bm - G - D - A, piano broken chords in eighths, very soft
CH = {'Bm': ['B3', 'D4', 'F#4', 'B4'], 'G': ['G3', 'B3', 'D4', 'G4'], 'D': ['A3', 'D4', 'F#4', 'A4'], 'A': ['A3', 'C#4', 'E4', 'A4'],
      'Em': ['G3', 'B3', 'E4', 'G4']}
order = [0, 2, 1, 3, 2, 1, 0, 2]
def arp(t0, ch, bars=1, vel=.36, pan=-.15, step=0.5, gain=1.0):
    for i in range(int(8 * bars / (step / 0.5))):
        n = CH[ch][order[i % 8]]
        P(t0 + i * b(step), n, b(step) * 1.6, vel * (1.08 if i % 4 == 0 else 0.92), pan + 0.1 * ((i % 2) * 2 - 1), gain=gain)
P(HIT['lightOn'], 'D5', 2.5, .42, .1)                                     # the first note, with the light
bars = [(b(4), 'Bm'), (b(8), 'G'), (b(12), 'D'), (b(16), 'A')]
for t0, ch in bars: arp(t0, ch)
P(HIT['line57'], 'D3', b(5), .42, .25, 'cellos', .8)                      # cellos under the number
P(HIT['line57'], 'A3', b(5), .34, -.25, 'violas', .6)
# B. newspaper: the motif again, quieter (an echo)
arp(b(18), 'Bm', 1, .30, .2); arp(b(20), 'G', 0.5, .28, .2)
# C. first flight: D at the glide, strings rise from the develop through the push, cut for the breath, arrive on D
P(b(20), 'D4', 1.5, .30, -.2); P(b(20), 'F#4', 1.5, .26, .2)
arp(b(21), 'D', 0.5, .30, 0)
T0 = HIT['develop']
for pitch, inst, pan, v in [('D4', 'violins', .35, .30), ('A3', 'violas', -.2, .30), ('D3', 'cellos', -.35, .32), ('F#4', 'violins', .5, .24)]:
    EV.append(dict(t=T0, inst=inst, pitch=pitch, dur=HIT['suck'] - T0, vel=v, pan=pan, attack=1.6, release=.08))
P(T0, 'A5', 3.0, .45, .3, 'vibraphone_bowed', .8)
for i in range(6): P(HIT['dive2'] + i * b(0.5), ['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5'][i], b(1), .30 + .04 * i, .1 * (i % 2 * 2 - 1))
E = HIT['enter']
for p in ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4', 'A4']: P(E, p, 3.2, .62, 0)
for pitch, inst, pan, v in [('D3', 'cellos', -.35, .55), ('A3', 'violas', -.15, .5), ('F#4', 'violins', .25, .5), ('A4', 'violins', .4, .48), ('D5', 'violins', .1, .42), ('D2', 'contrabass', 0, .45)]:
    EV.append(dict(t=E, inst=inst, pitch=pitch, dur=3.1, vel=v, pan=pan, attack=.04, release=1.2))
P(E, 'D6', 3.0, .5, .2, 'glass', .7)
P(E, 'hit', None, .32, 0, 'sus_cymbal', .45)
for i, n in enumerate(['A4', 'F#4', 'D4', 'E4', 'F#4']): P(E + b(4) + i * b(1), n, b(1.6), .30 - .02 * i, .15)
# D. measuring: piano in eighths on an A pedal, glass on the readings
for i in range(16):
    n = ['A3', 'E4', 'A4', 'C#5', 'E4', 'A4', 'C#5', 'E5'][i % 8]
    P(HIT['measure'] + i * b(0.5), n, b(0.8), .30 + .012 * i, .2 * (i % 2 * 2 - 1))
EV.append(dict(t=HIT['measure'], inst='cellos', pitch='A3', dur=HIT['hush'] - HIT['measure'], vel=.30, pan=-.3, attack=1.0, release=.1))
EV.append(dict(t=HIT['measure'], inst='violas', pitch='E4', dur=HIT['hush'] - HIT['measure'], vel=.26, pan=.3, attack=1.4, release=.1))
P(HIT['land852'], 'A5', 2.0, .5, .2, 'glass', .8); P(HIT['land852'], 'A3', 1.5, .42, 0); P(HIT['land852'], 'E4', 1.5, .36, 0)
P(HIT['land59'], 'E6', 2.0, .5, -.2, 'glass', .8); P(HIT['land59'], 'C#4', 1.5, .4, 0); P(HIT['land59'], 'A4', 1.5, .36, 0)
# E. the verdict: low hold, hush, then the strike lands on low D
P(HIT['verdict'], 'D2', 3.0, .7, 0); P(HIT['verdict'], 'D3', 3.0, .6, 0); P(HIT['verdict'], 'A3', 3.0, .45, 0)
P(HIT['verdict'], 'D6', 2.5, .55, .3, 'glass', .8)
P(HIT['verdict'], 'D3', 2.5, .45, 0, 'timpani', .5)
# F. the index and the end card: the theme, slow, in D
for i, n in enumerate(['F#4', 'A4', 'D5', 'C#5', 'A4']): P(HIT['index'] + i * b(1), n, b(1.8), .34, .15 * (i % 2 * 2 - 1))
for p in ['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']: P(HIT['endCard'], p, 4.0, .44, 0)
for pitch, inst, pan, v in [('D3', 'cellos', -.3, .38), ('A3', 'violas', -.1, .34), ('F#4', 'violins', .25, .32), ('D5', 'violins', .1, .28)]:
    EV.append(dict(t=HIT['endCard'], inst=inst, pitch=pitch, dur=3.4, vel=v, pan=pan, attack=.3, release=1.0))
P(HIT['endCard'], 'A5', 3.5, .45, -.2, 'vibraphone_bowed', .7)

mus = S.render(EV, dur=DUR + 0.5, master=False)
mus = mus[:N] if len(mus) >= N else np.pad(mus, ((0, N - len(mus)), (0, 0)))
mus = S.room(mus, size=.5, mix=.2)
# the breath before the photograph and the hush before the verdict: music sucked out
gate = np.ones(N)
for a, c in [(HIT['suck'] - 0.1, HIT['enter'] - 0.01), (HIT['hush'], HIT['verdict'] - 0.01)]:
    gate *= 1 - (seg(tt, a, a + 0.12) * (1 - seg(tt, c, c + 0.005)))
music += (mus * gate[:, None]).astype(np.float32)

# ---------------- foley ----------------
def glass_tap(v=1.0, pitch=1.0):
    d = .5; x = clack(1.6 * pitch, v); x = np.pad(x, (0, int(d * SR) - len(x)))
    ring_ = sum(a * np.sin(2 * np.pi * f * pitch * t_(d)) * env_exp(d, tau) for f, a, tau in [(3150, .25, .09), (5230, .15, .05), (1870, .12, .12)])
    return norm(x * .8 + ring_ * .5) * v
def paper(d=.45, v=1.0):
    x = bp(noise(d), 1800, 7000) * np.sin(np.pi * np.linspace(0, 1, int(round(d * SR)))) ** 1.5
    return norm(x) * v
def tick(v=1.0):
    d = .05; x = bp(noise(d), 2500, 9000) * env_exp(d, .003) + np.sin(2 * np.pi * 2200 * t_(d)) * env_exp(d, .006) * .4
    return norm(x) * v
def starter(v=1.0):
    d = .07; x = hp(noise(d), 800) * env_exp(d, .006) + np.sin(2 * np.pi * 900 * t_(d)) * env_exp(d, .01) * .5
    return norm(x) * v
def pen(d=.3, v=1.0):
    x = bp(noise(d), 2500, 6500) * (1 + .5 * np.sin(2 * np.pi * 37 * t_(d))) * np.sin(np.pi * np.linspace(0, 1, int(round(d * SR)))) ** .6
    return norm(x) * v
def swell(d=.8, v=1.0):
    x = lp(noise(d), 900) * np.linspace(0, 1, int(round(d * SR))) ** 2
    return norm(x) * v

for t0, v in [(0.0, .5), (0.17, .35), (0.30, .3), (0.42, .4), (0.55, .3)]: add(foley, starter(v), t0, .5, .35)
for k in ('drop1', 'drop2', 'drop3'): add(foley, glass_tap(1.0), HIT[k] - 0.02, .62, .1)
for t0 in (HIT['lift1'], HIT['rise2'] + 1.0, HIT['rise3'] + 1.0): add(foley, glass_tap(.5, 1.2), t0, .25, .1); add(foley, whoosh(.4, .6), t0, .25, -.2)
for k in ('lineDate', 'lineSuccess', 'line57', 'newsLine'): add(foley, paper(1.1, .8), HIT[k], .22, .25)
add(foley, glass_tap(.7, 1.5), HIT['pull57'], .3, .3)
for t0 in (b(15.4), HIT['newsLine'] - b(2), b(20.5), HIT['rise2'] + 0.5, HIT['rise3'] + 0.6): add(foley, paper(.8, .7), t0, .2, -.3)
for k, d in (('dive1', .8), ('dive2', 1.6), ('dive3', 1.2)): add(foley, whoosh(d, .7), HIT[k], .32, 0)
add(foley, swell(.8, .9), HIT['develop'] - 0.05, .35, 0)
# a riser through the push into the lens, cut dead at the breath
rd = HIT['suck'] - HIT['dive2']; ns = noise(rd); ramp = np.linspace(0, 1, len(ns))
riser = (bp(ns, 400, 2400) * .6 + hp(ns, 2400) * .4) * ramp ** 2.2
add(foley, (norm(riser) * .9).astype(np.float32), HIT['dive2'], .5, 0)
add(foley, glass_tap(.6, 1.3), HIT['ring57'], .25, .3)
# the measuring line: a tick each time it passes 100 ft
K = 852 * 25; D0 = K / (3617 - 1385)
def eio(x): return 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2
ts = np.arange(HIT['measure'], HIT['land852'], 1 / 240)
Ds = [D0 * (852 / D0) ** eio(float(seg(t, HIT['measure'], HIT['land852']))) for t in ts]
for D in range(100, 900, 100):
    i = next((j for j, d in enumerate(Ds) if d >= D), None)
    if i is not None: add(foley, tick(.9), ts[i], .3, .15)
add(foley, glass_tap(.8), HIT['land852'], .3, -.1)
add(foley, pen(.32, 1.0), HIT['verdict'], .4, -.2)
for i in range(5): add(foley, tick(.6), HIT['index'] + 0.2 + i * 0.15 + 0.45, .22, .3)

# ---------------- beds ----------------
# light-table hum: 100 Hz ballast with harmonics + a little tube noise; on while we are on the table
hum = sum(a * np.sin(2 * np.pi * f * tt + p) for f, a, p in [(100, .5, 0), (200, .35, 1), (300, .2, 2), (400, .12, 3), (1200, .03, 0)])
hum = hum * (1 + .1 * np.sin(2 * np.pi * .7 * tt)) + bp(noise(DUR + .5)[:N], 3000, 8000) * .05
on = seg(tt, HIT['lightOn'] - 0.25, HIT['lightOn'])
inside = np.zeros(N)
for a, c in [(HIT['enter'] - 0.3, HIT['rise2'] + 0.6), (HIT['measure'] - 0.6, HIT['rise3'] + 0.6)]:
    inside = np.maximum(inside, seg(tt, a, a + 0.6) * (1 - seg(tt, c - 0.6, c)))
beds[:, 0] += (hum * on * (1 - .85 * inside) * .05).astype(np.float32); beds[:, 1] += (hum * on * (1 - .85 * inside) * .05).astype(np.float32)
# wind and surf inside the photographs (the breath after the first flight keeps only this)
wind = lp(brown(DUR + .5)[:N], 700) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.23 * tt + 1) ** 2)
surf = lp(bp(noise(DUR + .5)[:N], 200, 1400), 900) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * tt) ** 4)
wb = (norm(wind) * .7 + norm(surf) * .3) * inside
beds[:, 0] += (wb * .16).astype(np.float32); beds[:, 1] += (np.roll(wb, 900) * .16).astype(np.float32)

# ---------------- voice ----------------
for v in TL['voice']:
    x, sr = sf.read(os.path.join(HERE, 'voice', 'out', v['id'] + '.wav'), dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    x = soxr.resample(x, sr, SR)
    x = compress(x / max(1e-6, np.abs(x).max()) * .9, thr=.22, ratio=3.0)
    x = hp(x, 70)
    add(voice, x.astype(np.float32), v['t'], 1.0, 0)

# ---------------- mix ----------------
def rms(x): return float(np.sqrt(np.mean(x ** 2)) + 1e-12)
vo = voice.mean(1); env = np.convolve(np.abs(vo) > .02, np.ones(int(.25 * SR)) / (.25 * SR), 'same'); env = np.clip(env * 3, 0, 1)
duck = 1 - 0.45 * env
vr = rms(voice[np.abs(voice).max(1) > .01])
mr = rms(music[np.abs(music).max(1) > .005])
music *= (vr / mr) * 10 ** (-11 / 20)                 # music ~11 dB under the voice before ducking
music *= duck[:, None].astype(np.float32)
foley *= (vr / max(rms(foley[np.abs(foley).max(1) > .01]), 1e-6)) * 10 ** (-9 / 20)
beds *= (vr / max(rms(beds[np.abs(beds).max(1) > .002]), 1e-6)) * 10 ** (-24 / 20)
# keep the sub-bass in check (everything but the voice)
from scipy.signal import butter, sosfilt
hpf = butter(4, 38, 'high', fs=SR, output='sos')
for x in (music, foley, beds):
    x[:] = sosfilt(hpf, x, axis=0)
mix = music + foley + beds + voice
# master: tame the transients (glass taps, the first piano notes) so loudnorm can reach -14 LUFS under -1.2 dBTP
from core.audio.sfx import limit
pk0 = np.abs(mix).max(); vr_lvl = rms(mix)
ceil = min(pk0, vr_lvl * 10 ** (11.5 / 20))       # peak-to-RMS at most ~11.5 dB
mix = np.stack([limit(mix[:, 0], ceil), limit(mix[:, 1], ceil)], 1).astype(np.float32)
peak = np.abs(mix).max(); mix *= .89 / peak
print('limiter ceiling', round(20 * np.log10(ceil / pk0), 1), 'dB under the raw peak')
os.makedirs(os.path.join(HERE, 'out', 'stems'), exist_ok=True)
for nm, x in (('music', music), ('foley', foley), ('beds', beds), ('voice', voice)): sf.write(os.path.join(HERE, 'out', 'stems', nm + '.wav'), (x / peak * .89).astype(np.float32), SR)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR)
print('mix written', round(len(mix) / SR, 2), 's; peak', round(float(peak), 3))
print('\n'.join(S.credits(sorted({e[1] if isinstance(e, tuple) else e['inst'] for e in EV}))))
