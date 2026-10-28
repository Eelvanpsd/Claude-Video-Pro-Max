"""Score, sound design and mix for 《林下的田》 The Fields Under the Forest -> out/mix.wav (48 kHz stereo) + out/stems/.

Everything sits on the timeline (timeline.json, exported from timeline.js) and the page's events (events.json).

  palette   dry first half: FM telemetry pings, pulse bass with audible 2nd/3rd harmonics, ticks that divide,
            filtered-noise scans, a pitched blip per canopy layer, sampled timpani / bass drum / gran cassa
            one wet organic timbre from the turn on: marimba (wood), with a warm detuned pad and bowed vibraphone
  beds      forest air (filtered wind in leaves, sparse synthesized bird calls) at the start and the end; thin air
  voice     Kokoro (bm_george), compressed, music ducked underneath

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
T = TL['T']; DUR = T['dur']; BEAT = 60 / TL['bpm']
N = int((DUR + 1.0) * SR)
rng = np.random.default_rng(31); S.seed(7)
MUS, PUL, HIT, FX, BED, VOX = (np.zeros((N, 2)) for _ in range(6))


def sos(kind, f, o=2): return butter(o, f, kind, fs=SR, output='sos')
def lpf(x, f, o=2): return sosfilt(sos('low', min(f, SR * .45), o), x, axis=0)
def hpf(x, f, o=2): return sosfilt(sos('high', f, o), x, axis=0)
def bpf(x, a, b, o=2): return sosfilt(sos('band', [a, min(b, SR * .45)], o), x, axis=0)
def tv(d): return np.arange(int(d * SR)) / SR
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
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
def fm(fc, ratio, index, d, tau_i=.15):
    t = tv(d); I = index * np.exp(-t / tau_i)
    return np.sin(2 * np.pi * fc * t + I * np.sin(2 * np.pi * fc * ratio * t))
def stereo(x, w=.0006):
    d = int(w * SR); return np.stack([x, np.concatenate([np.zeros(d), x[:-d]]) if d else x], 1)
def ping(m, vel=.6, d=1.4):
    t = tv(d); f = hz(m)
    return (fm(f, 3.5, 2.6, d, .05) * np.exp(-t / .5) + .3 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t / .3)) * vel
def blip(m, vel=.5, d=.18):
    return fm(hz(m), 2.0, 1.6, d, .03) * np.exp(-tv(d) / .05) * vel
def bass(m, d, vel=.8, cut=420):
    f = hz(m); x = saw(f, d, nh=16) * .8 + np.sin(2 * np.pi * f * tv(d)) * .9
    x = lpf(x, cut) + .12 * np.tanh(3 * lpf(x, 900))
    return x * adsr(d, .01, min(.2, d * .4)) * vel * .8
def pad(ms, d, vel=.25, cut=1400, a=.6, r=1.0):
    x = np.zeros(int(d * SR))
    for m in ms:
        for det in (-.0035, 0.0, .0041): x += saw(hz(m), d, det, nh=22)
    return (lpf(x, cut) * .7 + lpf(x, cut * .5) * .3) * adsr(d, a, r) * vel / max(1, len(ms))
def sweep(d, f0, f1, q=.35, vel=.5):
    n = rng.standard_normal(int(d * SR)); out = np.zeros_like(n); blk = 256
    for i in range(0, len(n), blk):
        u = i / max(1, len(n)); f = f0 * (f1 / f0) ** u
        lo, hi = f * (1 - q), min(f * (1 + q), SR * .45)
        s = max(0, i - 3000); y = sosfilt(sos('band', [lo, hi]), n[s:i + blk]); out[i:i + blk] = y[-(min(blk, len(n) - i)):]
    return out * np.sin(np.pi * np.clip(tv(d) / d, 0, 1)) ** 1.2 * vel
def bird(at, f0, g):
    """a short synthesized two-note call: a sine chirp with vibrato"""
    for k, (df, dd) in enumerate(((1.0, .09), (1.18, .07))):
        t = tv(dd); f = f0 * df * (1 + .06 * np.sin(2 * np.pi * 38 * t)) * (1 + .08 * t / dd)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dd) ** 2
        put(BED, x, at + k * .12, g, rng.uniform(-.6, .6))


# ------------------------------------------------------------------ beds
def beds():
    n = N
    wind = bpf(rng.standard_normal(n), 400, 3200) * .5 + bpf(rng.standard_normal(n), 120, 600) * .4
    gust = uniform_filter1d(rng.standard_normal(n), int(1.3 * SR)); gust = .6 + .4 * gust / (np.abs(gust).max() + 1e-9)
    leaves = wind * gust
    tt = np.arange(n) / SR
    forest = np.clip(1 - (tt - 3.6) / 1.6, 0, 1) * (tt < 5.2) + np.clip((tt - 34.4) / 1.6, 0, 1)   # opening, and J-cut back before the end card
    BED[:, 0] += leaves * forest * .9; BED[:, 1] += np.roll(leaves, 2400) * forest * .9
    air = bpf(rng.standard_normal(n), 200, 1500) * .18
    BED[:, 0] += air; BED[:, 1] += np.roll(air, 1200)
    for at in (0.9, 2.3, 3.1, 35.4, 36.6, 38.2):
        bird(at, rng.uniform(2600, 3600), .10)


# ------------------------------------------------------------------ score
def score():
    b = lambda n: n * BEAT
    # opening pad, D minor, filter opening with the scan
    put(MUS, stereo(pad([mi('D3'), mi('A3'), mi('F4')], b(23) - .2, .30, 900, 1.5, 1.2)), 0.0)
    put(MUS, stereo(pad([mi('D4'), mi('A4')], b(16), .16, 2200, 2.0, 1.0)), b(6))
    # telemetry: FM pings on 8ths during the scan and the cloud
    pat = ['D5', 'A5', 'F5', 'A5', 'D5', 'A5', 'E5', 'A5']
    for k in range(int((T['peel'] - T['scan1']) / (BEAT / 2))):
        t = T['scan1'] + k * BEAT / 2
        put(MUS, blip(mi(pat[k % 8]), .30 if k % 2 == 0 else .18), t, 1.0, -.4 if k % 2 else .4)
    # pulse bass from bar 2 of the scan
    for k in range(int((T['sil'] - b(8)) / (BEAT / 2))):
        t = b(8) + k * BEAT / 2
        put(PUL, stereo(bass(mi('D2') if (k // 8) % 2 == 0 else mi('C2'), BEAT / 2 * .9, .7 if k % 2 == 0 else .45)), t)
    # peel: ticks divide (8ths -> 16ths -> 32nds), a descending blip per layer, a rising shimmer as returns lift
    t = T['peel'] - BEAT
    while t < T['peelEnd']:
        u = (t - T['peel']) / (T['peelEnd'] - T['peel'])
        step = BEAT / 2 if u < .2 else BEAT / 4 if u < .65 else BEAT / 8
        put(FX, X.click(1.6, .35), t, .5, rng.uniform(-.5, .5)); t += step
    layers = ['D6', 'A5', 'F5', 'D5', 'A4']
    for i, n in enumerate(layers):
        tl = T['peel'] + i * BEAT
        put(MUS, ping(mi(n), .5, 1.2), tl, .9, .3 - .15 * i)
        put(FX, stereo(sweep(.6, 2500, 7000, .3, .25)), tl, .6)
    # near silence: a reversed swell into the impact
    sw = sweep(1.0, 300, 4000, .5, .5) * np.linspace(0, 1, int(SR)) ** 2
    put(FX, stereo(sw), T['turn'] - 1.0, .7)
    # the turn: impact + F major bloom, marimba enters
    put(HIT, S.hit('bass_drum', None, .95), T['turn'], 1.0)
    put(HIT, S.hit('gran_cassa', None, .8), T['turn'], .8)
    put(HIT, S.note('timpani', 'F2', 2.5, .9), T['turn'], .9)
    put(FX, stereo(sweep(1.2, 900, 160, .5, .4)), T['turn'], .5)          # the second scan settling
    chords = [(['F2', 'C3', 'A3', 'E4'], 4), (['D2', 'A2', 'F3', 'C4'], 4), (['Bb1', 'F2', 'D3', 'A3'], 4), (['C2', 'G2', 'E3', 'D4'], 4)]
    t = T['turn']
    for rep in range(3):
        for ch, beats in chords:
            if t > T['cardsOff'] + .5: break
            d = beats * BEAT
            put(MUS, stereo(pad([mi(n) for n in ch[1:]], d + .4, .24, 1300, .3, .6)), t)
            put(PUL, stereo(bass(mi(ch[0]) + 12, d * .95, .5, 300)), t)
            t += d
    put(MUS, S.render([(0, 'vibraphone_bowed', 'A4', 3.0, .55, -.2), (0, 'vibraphone_bowed', 'E5', 3.0, .45, .2)], dur=4.0), T['turn'] + .1, .55)
    # walls light up: marimba, one note per beat-half, rising through F major pentatonic
    scale = ['F4', 'A4', 'C5', 'D5', 'F5', 'G5', 'A5', 'C6']
    ev = []
    k = 0; t = T['walls']
    while t < T['wallsEnd'] - .01:
        ev.append((t - T['walls'], 'marimba', scale[(k * 3) % len(scale)] if k % 4 else scale[k % len(scale)], .4, .55 - .02 * (k % 3), (-.5 + (k % 5) * .25)))
        k += 1; t += BEAT / 2
    put(MUS, S.render(ev, dur=T['wallsEnd'] - T['walls'] + 2), T['walls'], .9)
    # measurement 1: ratchet while the counter rolls, ping when it lands
    t = T['r1']
    while t < T['r1Land']:
        put(FX, X.click(2.2, .5), t, .45, .2); t += .035
    put(MUS, ping(mi('C6'), .55, 1.6), T['r1Land'], .9, .3)
    put(MUS, S.render([(0, 'marimba', 'F3', .6, .7, 0), (0, 'marimba', 'C4', .6, .6, .2)], dur=2), T['r1Land'], .8)
    # section: suck-out, cut whoosh + low hit, ping on the reading
    put(FX, stereo(sweep(.5, 6000, 500, .4, .45)), T['sec'] - .1, .7)
    put(HIT, S.note('timpani', 'D2', 1.8, .7), T['sec'], .8)
    put(HIT, S.hit('bass_drum', None, .7), T['sec'], .6)
    put(MUS, ping(mi('A5'), .55, 1.6), T['r2'], .9, -.2)
    put(MUS, S.render([(0, 'marimba', 'D4', .6, .6, 0), (.31, 'marimba', 'A4', .6, .5, .2)], dur=2), T['r2'], .8)
    # history: bar growth tones
    for tb, m0, m1 in ((T['card1'], 'C5', 'F5'), (T['card2'], 'D5', 'A5')):
        d = .8; tt = tv(d); f = hz(mi(m0)) * (hz(mi(m1)) / hz(mi(m0))) ** (tt / d)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / d) * .3
        put(FX, stereo(x), tb, .6)
        put(MUS, S.render([(0, 'marimba', m1, .6, .55, 0)], dur=2), tb + d, .7)
    # canopy regrowth: soft rising shimmer of many small grains
    for k in range(70):
        t = T['ghost'] + (T['closed'] + 1 - T['ghost']) * (k / 70) ** .8
        put(FX, blip(mi('C6') + rng.integers(-5, 8), .12, .12), t, .5, rng.uniform(-.8, .8))
    # end card: final chord, marimba + pad + bowed vibraphone
    te = T['end']
    put(MUS, stereo(pad([mi('C3'), mi('F3'), mi('A3'), mi('G4')], DUR - te + .5, .30, 1500, .4, 2.5)), te)
    put(MUS, S.render([(0, 'marimba', 'F3', 2.5, .6, -.2), (.08, 'marimba', 'C4', 2.5, .5, 0), (.16, 'marimba', 'A4', 2.5, .5, .2), (.24, 'marimba', 'G5', 2.5, .45, .4),
                       (0, 'vibraphone_bowed', 'A4', 3.5, .4, 0)], dur=4.5), te, .9)
    put(HIT, S.note('timpani', 'F2', 2.5, .55), te, .6)


def foley():
    for e in EV:
        t, ty = e['t'], e['type']
        if ty == 'scan':
            d = e['to'] - t
            put(FX, stereo(sweep(d, 700, 3800, .35, .5)), t, .6)
            for k in range(int(d * 90)):                     # the photo turning into points: fine crackle
                put(FX, X.click(rng.uniform(1.5, 3.0), .2), t + k / 90 + rng.uniform(0, .01), .18, rng.uniform(-.7, .7))
        elif ty == 'land':
            put(FX, X.thump(.5, 110), t, .35)


def voice():
    for e in EV:
        if e['type'] != 'vo': continue
        x, sr = sf.read(os.path.join(HERE, 'voice/out', e['id'] + '.wav'))
        if x.ndim > 1: x = x.mean(1)
        x = soxr.resample(x, sr, SR); x = hpf(x, 90)
        x = X.compress(x / (np.abs(x).max() + 1e-9) * .9, thr=.22, ratio=3.2, att=.003, rel=.09)
        put(VOX, stereo(x, .0002), e['t'])


def lufs(x):
    import subprocess, tempfile, re
    f = os.path.join(tempfile.mkdtemp(), 'm.wav'); sf.write(f, x.astype(np.float32), SR)
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1])
def true_peak(x): return float(np.abs(soxr.resample(x, SR, 4 * SR)).max())
def tp_limit(x, ceil):
    up = np.abs(soxr.resample(x, SR, 4 * SR)).max(1); n = len(x)
    pk = np.pad(up, (0, max(0, n * 4 - len(up))))[:n * 4].reshape(-1, 4).max(1)
    g0 = np.minimum(1.0, ceil / np.maximum(pk, 1e-9)); look = int(.004 * SR)
    g = -maximum_filter1d(-g0, 2 * look + 1); g = uniform_filter1d(g, look); g = np.minimum(g, -maximum_filter1d(-g0, 3))
    return x * g[:, None]


def main():
    beds(); score(); foley(); voice()
    mus = S.room(MUS, .55, .22); pul = S.room(PUL, .3, .12); hit = S.room(HIT, .7, .25); fx = FX.copy(); bed = BED.copy()
    v = np.abs(VOX).mean(1)
    env = uniform_filter1d(maximum_filter1d(v, int(.12 * SR)), int(.15 * SR)); env = np.clip(env / (env.max() + 1e-9) * 3, 0, 1)
    # near silence before the turn: music and pulse stop, foley decays, only the air bed (and the reversed swell)
    a, bnd = int((T['sil'] + .05) * SR), int(T['turn'] * SR); f = int(.12 * SR)
    for buf in (mus, pul):
        buf[a:a + f] *= (np.linspace(1, 0, f) ** 2)[:, None]; buf[a + f:bnd] *= 0
    # suck-out before the section cut
    i0, i1 = int((T['sec'] - .28) * SR), int((T['sec'] - .01) * SR); f = int(.05 * SR)
    g = np.ones(N); g[i0:i0 + f] = np.linspace(1, .05, f); g[i0 + f:i1] = .05
    for buf in (mus, pul): buf *= g[:, None]
    g_mus, g_pul, g_hit, g_fx, g_bed = 0.16, 0.42, 0.75, 0.40, 0.30
    duck_m = (1 - .45 * env)[:, None]; duck_p = (1 - .3 * env)[:, None]; duck_b = (1 - .3 * env)[:, None]
    stems = {'music': mus * g_mus * duck_m, 'pulse': pul * g_pul * duck_p, 'hits': hit * g_hit, 'fx': fx * g_fx, 'beds': bed * g_bed * duck_b, 'voice': VOX}
    shelf = 10 ** (-5 / 20)
    for k in ('music', 'pulse', 'hits', 'beds', 'fx'):
        x = hpf(stems[k], 46 if k == 'hits' else 38, 4 if k == 'hits' else 2)
        stems[k] = x - (1 - shelf) * lpf(x, 62, 2)
    bus = stems['music'] + stems['pulse'] + stems['fx'] + stems['beds']
    lvl = np.sqrt(uniform_filter1d((bus ** 2).max(1), int(.012 * SR)))
    thr = 10 ** (-12 / 20) * np.percentile(lvl, 99.9)
    g = np.where(lvl > thr, (thr + (lvl - thr) / 2.5) / np.maximum(lvl, 1e-9), 1.0)
    g = uniform_filter1d(-maximum_filter1d(-g, int(.008 * SR)), int(.03 * SR))
    mix = bus * g[:, None] + stems['hits'] + stems['voice']
    mix = mix[:int(DUR * SR)]
    fade = int(.6 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    for _ in range(3):
        I = lufs(mix); mix = mix * 10 ** ((-14.4 - I) / 20); mix = tp_limit(mix, 10 ** (-4.6 / 20))
    print(f'master: {lufs(mix):.2f} LUFS, true peak {20 * np.log10(true_peak(mix)):.2f} dBTP')
    os.makedirs(os.path.join(HERE, 'out/stems'), exist_ok=True)
    sf.write(os.path.join(HERE, 'out/mix.wav'), mix.astype(np.float32), SR)
    for name, bb in stems.items():
        sf.write(os.path.join(HERE, 'out/stems', name + '.wav'), bb[:int(DUR * SR)].astype(np.float32), SR)
    from numpy.fft import rfft, rfftfreq
    m = mix.mean(1); Fq = rfftfreq(len(m), 1 / SR); P = np.abs(rfft(m)) ** 2
    lo = P[(Fq > 20) & (Fq < 120)].sum(); rest = P[(Fq >= 120) & (Fq < 16000)].sum()
    print(f'low/rest {10 * np.log10(lo / rest):.1f} dB  peak {np.abs(mix).max():.2f}')


if __name__ == '__main__':
    main()
