"""Score, foley, beds and voice for 《被炸平的城市怎样长回来》 -> out/mix.wav + out/stems/*.wav
usage (from the library root): .venv/bin/python <demo>/mix.py
Reads timeline.json (beats, sections, VO times) and events.json (window.EV from the page: every layer, pop, tick, roof).
100 BPM, beat 0.6 s. C minor (the hole) -> E-flat major (the growth) -> A-flat major (the sun) -> C major (lights up).
Palette: the showroom (projector fan, relays, lamp strike, air of the light wash), mallets and glass for light,
bowed vibraphone for held light, contrabass/cellos only as a floor, brass for the two weights (the date, the sun)."""
import os, sys, json
import numpy as np, soundfile as sf, soxr
from scipy.signal import butter, sosfilt
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB') or os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, LIB)
from core.audio import sampler as S
from core.audio import sfx as X
SR = X.SR
TL = json.load(open(os.path.join(HERE, 'timeline.json')))
EVJ = json.load(open(os.path.join(HERE, 'events.json')))
T = TL['T']; BEAT = 60 / TL['bpm']; DUR = EVJ['dur']; EV = EVJ['ev']
N = int((DUR + 3) * SR)
MUS, HIT, FX, BED, VOX = (np.zeros((N, 2), np.float32) for _ in range(5))
S.seed(7)
rng = np.random.default_rng(11)

def sos(kind, f, o=2): return butter(o, f, kind, fs=SR, output='sos')
def lpf(x, f, o=2): return sosfilt(sos('low', min(f, SR * .45), o), x, axis=0)
def hpf(x, f, o=2): return sosfilt(sos('high', f, o), x, axis=0)
def bpf(x, a, b, o=2): return sosfilt(sos('band', [a, min(b, SR * .45)], o), x, axis=0)
def tv(d): return np.arange(int(d * SR)) / SR
def put(buf, x, at, g=1.0, pan=0.0):
    if x.ndim == 1: X.add(buf, x.astype(np.float32), at, g, pan)
    else:
        s = int(at * SR); e = min(len(buf), s + len(x))
        if s < len(buf): buf[s:e] += x[:e - s] * g
def place(buf, events, g=1.0):
    y = S.render(events, dur=N / SR, master=False); buf[:len(y)] += y[:len(buf)] * g
def b(n): return n * BEAT

# ------------------------------------------------------------------ synth helpers
def hum(d, f0=118, amt=1.0):
    """projector fan + transformer: a low hum with harmonics and a filtered air bed"""
    t = tv(d); x = sum(np.sin(2 * np.pi * f0 * k * t + k) / k ** 1.4 for k in range(1, 6)) * .25
    air = bpf(rng.standard_normal(len(t)), 300, 2400) * .5
    return (x * .35 + air) * amt
def room_tone(d):
    t = tv(d); x = lpf(np.cumsum(rng.standard_normal(len(t))) * .002, 260, 2); x -= lpf(x, 20)
    return x / (np.abs(x).max() + 1e-9)
def relay(v=1.0):
    a = X.clack(.7, v); b_ = X.thump(.6 * v, 55)
    n = max(len(a), len(b_)); y = np.zeros(n); y[:len(a)] += a; y[:len(b_)] += b_ * .8
    return y
def lamp(v=1.0):
    t = tv(1.4)
    zap = hpf(rng.standard_normal(len(t)), 2500) * np.exp(-t / .012) * .6
    whump = np.sin(2 * np.pi * (52 + 30 * np.exp(-t / .05)) * t) * np.exp(-t / .35)
    buzz = np.sin(2 * np.pi * 100 * t) * (1 - np.exp(-t / .08)) * np.exp(-t / .5) * .12
    return (zap + whump + buzz) * v
def swell(d, f0, f1, v=1.0, q=.5):
    """air of the light wash: band noise whose centre slides f0 -> f1, rising then settling"""
    t = tv(d); x = rng.standard_normal(len(t)); out = np.zeros_like(x); seg_ = 2048
    for i in range(0, len(x), seg_):
        k = i / len(x); fc = f0 * (f1 / f0) ** k
        out[i:i + seg_] = bpf(x[max(0, i - 512):i + seg_], fc * (1 - q / 2), fc * (1 + q / 2))[-len(x[i:i + seg_]):]
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return out * e * v
def tick(pitch=1.0, v=1.0):
    t = tv(.06); return np.sin(2 * np.pi * 2400 * pitch * t) * np.exp(-t / .006) * v + hpf(rng.standard_normal(len(t)), 3000) * np.exp(-t / .003) * .3 * v
def riser(d, v=1.0):
    t = tv(d); x = swell(d, 300, 5000, 1.0, .35)
    return x * (t / d) ** 1.6 * v
def punch(vel=1.0, d=.9):
    """mid-range body for the impacts (60-120 Hz), so they land on small speakers"""
    t = tv(d); f = 95 * np.exp(-t / .09) + 62
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .22) * vel

# ------------------------------------------------------------------ score
def score():
    m, h = [], []
    # white (0–1.8): one held, bowed tone; the room
    m += [dict(t=.2, inst='vibraphone_bowed', pitch='G4', dur=1.5, vel=.35, pan=-.2, attack=.3, release=.4),
          dict(t=.5, inst='vibraphone_bowed', pitch='C5', dur=1.2, vel=.3, pan=.25, attack=.3, release=.4)]
    # the hole (2.4–12): C minor floor, bowed vibraphone, sparse mallets
    L = T['lamp']
    m += [dict(t=L, inst='contrabass', pitch='C2', dur=T['date'] - L - .5, vel=.55, pan=0, attack=.25, release=.3),
          dict(t=L, inst='cellos', pitch='G2', dur=T['date'] - L - .5, vel=.45, pan=-.25, attack=.4, release=.3),
          dict(t=L + .3, inst='vibraphone_bowed', pitch='Eb5', dur=2.6, vel=.4, pan=.3, attack=.5)]
    for i, p in enumerate(['C4', 'G4', 'Eb4', 'G4', 'C4', 'G4', 'D4', 'G4']):         # a quiet marimba pulse under the wash
        m.append(dict(t=L + b(1) + i * b(.5), inst='marimba', pitch=p, dur=.3, vel=.32 + .02 * i, pan=-.3 + .08 * i))
    D_ = T['date']
    # the date: timpani + gran cassa + gong + low brass stab, then the drone of the aftermath
    h += [dict(t=D_, inst='timpani', pitch='C3', dur=3, vel=1.0, pan=0), dict(t=D_, inst='gran_cassa', pitch='hit', vel=.95, pan=0),
          dict(t=D_, inst='gong2', pitch='big', vel=.75, pan=.1), dict(t=D_ + .01, inst='bass_drum', pitch=None, vel=.9, pan=0)]
    for p, inst, v in (('C2', 'tuba', .9), ('C3', 'trombone', .85), ('G3', 'trombone', .8), ('Eb4', 'horn', .75), ('C4', 'horn', .75)):
        h.append(dict(t=D_, inst=inst, pitch=p, dur=1.1, vel=v, pan=0, release=.5))
    m += [dict(t=D_ + .3, inst='contrabass', pitch='C2', dur=T['g1'] - D_ - .5, vel=.5, attack=.6, release=.5),
          dict(t=D_ + .3, inst='cellos', pitch='Eb3', dur=T['g1'] - D_ - .5, vel=.32, pan=.2, attack=.8, release=.5),
          dict(t=D_ + 1.2, inst='vibraphone_bowed', pitch='Ab4', dur=2.4, vel=.35, pan=-.3, attack=.5),
          dict(t=D_ + 3.6, inst='vibraphone_bowed', pitch='G4', dur=2.2, vel=.35, pan=.3, attack=.5)]
    for k, p in enumerate(['C5', 'Eb5', 'G4', 'Ab4']):
        m.append(dict(t=D_ + b(4) + k * b(2), inst='vibraphone', pitch=p, dur=1.2, vel=.3, pan=.4 - .25 * k))
    # growth (12–16.5): E-flat major, the bass climbs a step per layer, mallets divide 8ths -> 16ths -> triplets
    layers = [(T['g1'], T['g2'], 'Eb2', ['Eb4', 'Bb4', 'G4', 'Bb4'], 2), (T['g2'], T['g3'], 'F2', ['F4', 'C5', 'Ab4', 'C5'], 4),
              (T['g3'], T['g4'], 'G2', ['G4', 'Eb5', 'Bb4', 'Eb5'], 4), (T['g4'], T['hgt0'], 'Ab2', ['Ab4', 'Eb5', 'C5', 'Eb5'], 6)]
    for i, (a, z, bass, arp, div) in enumerate(layers):
        m.append(dict(t=a, inst='contrabass', pitch=bass, dur=z - a + .1, vel=.55, pan=0, attack=.05, release=.2))
        m.append(dict(t=a, inst='cellos', pitch=bass.replace('2', '3'), dur=z - a + .1, vel=.4, pan=-.2, attack=.1, release=.2))
        n = int(round((z - a) / (BEAT / div)))
        for k in range(n):
            m.append(dict(t=a + k * BEAT / div, inst='marimba', pitch=arp[k % 4], dur=.2, vel=.42 + .1 * (k % div == 0), pan=-.35 + .7 * ((k * 3) % 7) / 6))
        m.append(dict(t=a, inst='hand_chimes', pitch=arp[0].replace('4', '5'), dur=1.2, vel=.5, pan=.3))
        if i >= 1:
            for k in range(n // 2):
                m.append(dict(t=a + k * BEAT / div * 2, inst='violins_pizz', pitch=arp[(k + 2) % 4].replace('4', '5'), dur=.2, vel=.4, pan=.4))
    # horns swell as the city crosses the river
    m += [dict(t=T['g3'], inst='horn', pitch=p, dur=T['hgt0'] - T['g3'], vel=.55, pan=pn, attack=.6, release=.6) for p, pn in (('G3', -.2), ('Bb3', .2), ('Eb4', 0))]
    # height (18–21): A-flat major, a glockenspiel line climbing with the level, bell on the top
    H0, HT = T['hgt0'], T['hgtTop']
    m += [dict(t=H0, inst='contrabass', pitch='Ab1', dur=T['dark'] - H0, vel=.55, attack=.3, release=.15),
          dict(t=H0, inst='vibraphone_bowed', pitch='C5', dur=T['dark'] - H0, vel=.4, pan=-.3, attack=.8, release=.2),
          dict(t=H0, inst='vibraphone_bowed', pitch='Eb5', dur=T['dark'] - H0, vel=.35, pan=.3, attack=1.2, release=.2)]
    climb = ['Ab4', 'C5', 'Eb5', 'G5', 'Ab5', 'C6', 'Eb6', 'G6', 'Ab6', 'C7']
    n = int(round((HT - H0) / (BEAT / 2)))
    for k in range(n):
        m.append(dict(t=H0 + k * BEAT / 2, inst='glockenspiel', pitch=climb[min(len(climb) - 1, k * len(climb) // n)], dur=.4, vel=.5 + .35 * k / n, pan=-.4 + .8 * k / n))
        m.append(dict(t=H0 + k * BEAT / 2, inst='vibraphone', pitch=climb[min(len(climb) - 1, k * len(climb) // n)].replace('6', '5').replace('7', '6'), dur=.4, vel=.3, pan=.3))
    h += [dict(t=HT, inst='tubular_bells', pitch='Eb5', dur=3, vel=.8, pan=.1), dict(t=HT, inst='sus_cymbal', pitch='hit', vel=.5, pan=-.2)]
    # the sun (22.8): first sound after the silence, warm brass in A-flat, bowed vibraphone and a low organ floor
    SU = T['sun']
    for p, inst, v, pn in (('Ab2', 'trombone', .75, -.2), ('Eb3', 'trombone', .7, .2), ('Ab3', 'horn', .75, -.3), ('C4', 'horn', .72, .3), ('Eb4', 'horn', .68, 0), ('Ab1', 'tuba', .7, 0)):
        h.append(dict(t=SU, inst=inst, pitch=p, dur=3.0, vel=v, pan=pn, attack=.05, release=1.2))
    h += [dict(t=SU, inst='timpani', pitch='Ab2', dur=3, vel=.85), dict(t=SU, inst='gran_cassa', pitch='hit', vel=.7), dict(t=SU, inst='sus_cymbal', pitch='bow', vel=.6, pan=.2)]
    m += [dict(t=SU + .1, inst='organ_soft', pitch=p, dur=T['line0'] - SU, vel=.35, pan=pn, attack=.6, release=.6) for p, pn in (('Ab2', 0), ('Eb3', -.3), ('C4', .3))]
    m += [dict(t=SU + .4, inst='vibraphone_bowed', pitch=p, dur=T['line0'] - SU - .2, vel=.35, pan=pn, attack=.8) for p, pn in (('Ab4', -.3), ('C5', .3))]
    # the shadow line (27–28.8): F minor, a timpani heartbeat, the line lands on a low hit
    L0, LE = T['line0'], T['lineEnd']
    m += [dict(t=L0, inst='contrabass', pitch='F1', dur=T['roofs1'] - L0, vel=.55, attack=.2), dict(t=L0, inst='cellos', pitch='C3', dur=T['roofs1'] - L0, vel=.4, pan=-.2, attack=.3),
          dict(t=L0, inst='organ_soft', pitch='F3', dur=T['roofs1'] - L0, vel=.3, pan=.2, attack=.4), dict(t=L0, inst='organ_soft', pitch='Ab3', dur=T['roofs1'] - L0, vel=.28, pan=-.2, attack=.4)]
    for k in range(0, int((T['roofs1'] - L0) / BEAT) + 1, 2):
        h.append(dict(t=L0 + k * BEAT, inst='timpani', pitch='F2', dur=1, vel=.55 + .05 * (k % 4 == 0)))
    h += [dict(t=LE, inst='timpani', pitch='C3', dur=2, vel=.9), dict(t=LE, inst='bass_drum', pitch=None, vel=.75), dict(t=LE, inst='tubular_bells', pitch='C5', dur=3, vel=.55)]
    # the roofs (29.4–31.2): one glass note per roof, the pre-war ones lower (and amber on screen)
    for e in EV:
        if e['type'] == 'roof':
            m.append(dict(t=e['t'], inst='glass', pitch='G5' if e['pre'] else 'C6', dur=1.2, vel=.55 if e['pre'] else .45, pan=-.5 + e['i'] / 15))
    # coda (31.2–35.4): D-flat -> E-flat sus, held; lights up (35.4): C major, bell
    C0 = T['roofs1']
    m += [dict(t=C0, inst='contrabass', pitch='Db2', dur=2.4, vel=.5, attack=.3), dict(t=C0 + 2.4, inst='contrabass', pitch='Eb2', dur=T['lights'] - C0 - 2.4, vel=.5, attack=.3),
          dict(t=C0, inst='vibraphone_bowed', pitch='F4', dur=2.4, vel=.38, pan=-.3, attack=.5), dict(t=C0, inst='vibraphone_bowed', pitch='Ab4', dur=4.2, vel=.36, pan=.3, attack=.5),
          dict(t=C0 + 2.4, inst='vibraphone_bowed', pitch='Bb4', dur=T['lights'] - C0 - 2.4, vel=.36, pan=-.3, attack=.5),
          dict(t=C0, inst='organ_soft', pitch='Db3', dur=2.4, vel=.28, attack=.5), dict(t=C0 + 2.4, inst='organ_soft', pitch='Eb3', dur=T['lights'] - C0 - 2.4, vel=.28, attack=.5)]
    LI = T['lights']
    m += [dict(t=LI, inst='contrabass', pitch='C2', dur=DUR - LI, vel=.5, attack=.4, release=1.5),
          dict(t=LI, inst='horn', pitch='E3', dur=3.5, vel=.5, pan=-.2, attack=.6, release=1.2), dict(t=LI, inst='horn', pitch='G3', dur=3.5, vel=.5, pan=.2, attack=.6, release=1.2),
          dict(t=LI, inst='vibraphone_bowed', pitch='C5', dur=DUR - LI - .5, vel=.4, pan=-.3, attack=.6), dict(t=LI, inst='vibraphone_bowed', pitch='E5', dur=DUR - LI - .5, vel=.36, pan=.3, attack=.9),
          dict(t=T['end'], inst='tubular_bells', pitch='C5', dur=4, vel=.6, pan=0), dict(t=T['end'] + b(2), inst='glass', pitch='G5', dur=3, vel=.35, pan=.4),
          dict(t=T['end'] + b(3), inst='glass', pitch='C6', dur=3, vel=.3, pan=-.4)]
    place(MUS, m); place(HIT, h)

# ------------------------------------------------------------------ foley and beds
def foley():
    put(BED, np.stack([room_tone(DUR + 2), room_tone(DUR + 2)], 1) * .5, 0)
    # projector fan: idle, up when the lamp strikes, down for the silence, up with the sun, down with the lights
    fan = hum(DUR + 2); t = tv(DUR + 2)
    def lvl(t):
        v = np.full_like(t, .25)
        v += .75 * np.clip((t - T['lamp']) / .4, 0, 1)
        v -= .55 * np.clip((t - T['dark']) / .3, 0, 1) - .55 * np.clip((t - T['sun']) / .5, 0, 1)
        v -= .6 * np.clip((t - T['lights']) / 1.0, 0, 1)
        return np.clip(v, .12, 1)
    put(BED, fan * lvl(t)[:len(fan)], 0, .5, -.15)
    for e in EV:
        ty, t0 = e['type'], e['t']
        if ty == 'relay': put(FX, relay(1.0), t0, .9, -.3)
        elif ty == 'lamp': put(FX, lamp(1.0), t0, .9, .1)
        elif ty == 'wash': put(FX, swell(e['dur'] + .6, 350, 2200, .8, .6), t0, .55, 0)
        elif ty == 'pop': put(FX, tick(.8 + .5 * rng.random(), .35), t0, .5, float(rng.uniform(-.7, .7)))
        elif ty == 'layer': put(FX, swell(.9, 900, 3200, .7, .5), t0 - .15, .35, float(rng.uniform(-.3, .3)))
        elif ty == 'pin': put(FX, tick(1.6, .5), t0, .45, .2)
        elif ty == 'climb': put(FX, riser(e['dur'], 1.0), t0, .75, 0)
        elif ty == 'dark': put(FX, X.clack(.5, .6), t0, .5, .3)
        elif ty == 'tick': put(FX, X.click(1.3, .9), t0, .7, .25)
        elif ty == 'lineEnd': put(FX, X.click(.8, 1.0), t0, .7, .25)
        elif ty == 'lights':
            put(FX, relay(.9), t0, .8, -.4); put(FX, relay(.7), t0 + .14, .6, .4)
        elif ty == 'suck': put(FX, swell(e['dur'] + .1, 3000, 400, .6, .5), t0, .35, 0)
    # punch under the two weights (the date, the sun) and the line landing
    for t0, v in ((T['date'], 1.0), (T['sun'], .75), (T['lineEnd'], .55)):
        put(HIT, punch(v), t0, .9, 0)

def voice():
    for L in TL['VO']:
        x, sr = sf.read(os.path.join(HERE, 'voice/out', L['id'] + '.wav'))
        if x.ndim > 1: x = x.mean(1)
        x = soxr.resample(x, sr, SR); x = hpf(x, 85)
        x = X.compress(x / (np.abs(x).max() + 1e-9) * .9, thr=.22, ratio=3.0, att=.003, rel=.09)
        x = x + .05 * lpf(x, 2500)
        put(VOX, np.stack([x, x], 1), L['t'])

# ------------------------------------------------------------------ mix and master
def rms(x): return float(np.sqrt(np.mean(x ** 2) + 1e-12))
def lufs(x):
    import subprocess, tempfile, re
    f = os.path.join(tempfile.mkdtemp(), 'm.wav'); sf.write(f, x.astype(np.float32), SR)
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1])
def true_peak(x): return float(np.abs(soxr.resample(x, SR, 4 * SR)).max())
def tp_limit(x, ceil):
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    up = np.abs(soxr.resample(x, SR, 4 * SR)).max(1); n = len(x)
    pk = np.pad(up, (0, max(0, n * 4 - len(up))))[:n * 4].reshape(-1, 4).max(1)
    g0 = np.minimum(1.0, ceil / np.maximum(pk, 1e-9)); look = int(.004 * SR)
    g = -maximum_filter1d(-g0, 2 * look + 1); g = uniform_filter1d(g, look); g = np.minimum(g, -maximum_filter1d(-g0, 3))
    return x * g[:, None]

def main():
    score(); foley(); voice()
    from scipy.ndimage import uniform_filter1d, maximum_filter1d
    mus = S.room(MUS, .6, .24); hit = S.room(HIT, .7, .26); fx = S.room(FX, .35, .12); bed = BED.copy()
    v = np.abs(VOX).mean(1)
    env = uniform_filter1d(maximum_filter1d(v, int(.12 * SR)), int(.15 * SR)); env = np.clip(env / (env.max() + 1e-9) * 3, 0, 1)
    # suck-out before the date (music, foley and beds dip), and the silence before the sun (everything but a thin fan)
    def gate(a, b_, floor, f=.06):
        g = np.ones(N); i0, i1 = int(a * SR), int(b_ * SR); k = int(f * SR)
        g[i0:i0 + k] = np.linspace(1, floor, k); g[i0 + k:i1] = floor; return g[:, None]
    g1 = gate(T['date'] - .45, T['date'] - .005, .05)
    mus *= g1; fx *= gate(T['date'] - .45, T['date'] - .005, .2); bed *= gate(T['date'] - .45, T['date'] - .005, .4)
    gs = gate(T['dark'] + .05, T['sun'] - .005, .0, .25)
    mus *= gs; hit *= gate(T['dark'] + .4, T['sun'] - .005, .0, .5); fx *= gate(T['dark'] + .3, T['sun'] - .005, 0., .2)
    bed *= gate(T['dark'] + .2, T['sun'] - .005, .35, .4)
    speaking = env > .5
    g_mus, g_hit, g_fx, g_bed = .35, .75, .5, .32
    stems = {'music': mus * g_mus * (1 - .4 * env)[:, None], 'hits': hit * g_hit * (1 - .2 * env)[:, None],
             'fx': fx * g_fx, 'beds': bed * g_bed * (1 - .3 * env)[:, None], 'voice': VOX * 1.0}
    shelf = 10 ** (-5 / 20)
    for k in ('music', 'hits', 'beds', 'fx'):
        x = hpf(stems[k], 46 if k == 'hits' else 38, 4 if k == 'hits' else 2)
        stems[k] = x - (1 - shelf) * lpf(x, 62, 2)
    # balance: voice about 10 dB over the music while it speaks
    vr = rms(stems['voice'][speaking]); mr = rms(stems['music'][speaking])
    stems['music'] *= min(3.0, (vr / 10 ** (10 / 20)) / max(mr, 1e-9))
    bus = stems['music'] + stems['fx'] + stems['beds']
    lvl = np.sqrt(uniform_filter1d((bus ** 2).max(1), int(.012 * SR)))
    thr = 10 ** (-12 / 20) * np.percentile(lvl, 99.9)
    g = np.where(lvl > thr, (thr + (lvl - thr) / 2.5) / np.maximum(lvl, 1e-9), 1.0)
    g = uniform_filter1d(-maximum_filter1d(-g, int(.008 * SR)), int(.03 * SR))
    mix = bus * g[:, None] + stems['hits'] + stems['voice']
    mix = mix[:int(DUR * SR)]
    fade = int(.8 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
    for _ in range(3):
        I = lufs(mix); mix = mix * 10 ** ((-14.4 - I) / 20); mix = tp_limit(mix, 10 ** (-4.6 / 20))
    print(f'master: {lufs(mix):.2f} LUFS, true peak {20 * np.log10(true_peak(mix)):.2f} dBTP')
    os.makedirs(os.path.join(HERE, 'out/stems'), exist_ok=True)
    sf.write(os.path.join(HERE, 'out/mix.wav'), mix.astype(np.float32), SR)
    for name, b_ in stems.items(): sf.write(os.path.join(HERE, 'out/stems', name + '.wav'), b_[:int(DUR * SR)].astype(np.float32), SR)
    m = mix.mean(1); Fq = np.fft.rfftfreq(len(m), 1 / SR); P = np.abs(np.fft.rfft(m)) ** 2
    lo = P[(Fq > 20) & (Fq < 120)].sum(); rest = P[(Fq >= 120) & (Fq < 16000)].sum()
    vm = 20 * np.log10(rms(stems['voice'][:int(DUR * SR)][speaking[:int(DUR * SR)]]) / rms(stems['music'][:int(DUR * SR)][speaking[:int(DUR * SR)]]))
    print(f'voice over music while speaking {vm:.1f} dB, low/rest {10 * np.log10(lo / rest):.1f} dB')

if __name__ == '__main__':
    main()
