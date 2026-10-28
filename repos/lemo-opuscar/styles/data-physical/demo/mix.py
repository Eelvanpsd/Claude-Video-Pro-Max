"""《两条螺旋》配乐 + 音效 + 旁白 → out/mix.wav（及 out/stems/）
读 out/timeline.json（tools/export.mjs 写）与 events.json（core/render/events.mjs 写）。
96 BPM，D 大调。乐器：VSCO 2 CE / VCSL 采样（CC0）+ numpy 合成；音效全部程序化。
金属片落定 = 明亮短促的金属 tick；亚克力 = 更闷的塑料 tok；黄铜刻度片 = 有音高的一声（太阳能：钟琴，风电：玻璃杯琴），
按"第几个 100 GW"在 D 大调五声音阶上一级一级往上走。
"""
import os, sys, json
import numpy as np, soundfile as sf, soxr
from scipy.signal import butter, sosfilt
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB') or os.path.abspath(os.path.join(HERE, '../../..'))
sys.path.insert(0, LIB)
from core.audio import sampler as S, sfx as X
SR = X.SR
TL = json.load(open(os.path.join(HERE, 'out/timeline.json')))
EV = json.load(open(os.path.join(HERE, 'events.json')))['ev']
DUR, BEAT, BAR, T = TL['DUR'], TL['BEAT'], TL['BAR'], TL['T']
N = int((DUR + 4) * SR)
rng = np.random.default_rng(11); S.seed(11)
MUS, PUL, HIT, FX, BED, VOX = (np.zeros((N, 2)) for _ in range(6))
USED = set()

def sos(kind, f, o=2): return butter(o, f, kind, fs=SR, output='sos')
def lpf(x, f, o=2): return sosfilt(sos('low', min(f, SR * .45), o), x, axis=0)
def hpf(x, f, o=2): return sosfilt(sos('high', f, o), x, axis=0)
def bpf(x, a, b, o=2): return sosfilt(sos('band', [a, min(b, SR * .45)], o), x, axis=0)
def tv(d): return np.arange(int(d * SR)) / SR
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
def mi(n): return 12 * (int(n[-1]) + 1) + NOTE[n[:-1]]
def q(bar, beat=0): return bar * BAR + beat * BEAT
def put(buf, x, at, g=1.0, pan=0.0):
    x = np.asarray(x, np.float64)
    if x.ndim == 2:
        s = int(at * SR)
        if s >= len(buf): return
        if s < 0: x = x[-s:]; s = 0
        e = min(len(buf), s + len(x)); buf[s:e] += x[:e - s] * g
    else: X.add(buf, x, at, g, pan)
def inst(buf, t, name, pitch, dur, vel, g=1.0, pan=0.0, **kw):
    USED.add(name); I = S.load(name)
    x = S.hit(I, pitch, vel, dur) if I.kind == 'hit' else S.note(I, pitch, dur, vel, **kw)
    put(buf, x, t, g, pan)
def adsr(d, a=.005, r=.1):
    n = int(d * SR); e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na); nr = min(n, int(r * SR)); e[n - nr:] *= np.linspace(1, 0, nr) ** 1.5; return e
def saw(f, d, det=0.0, nh=30):
    t = tv(d); x = np.zeros_like(t)
    for k in range(1, nh):
        if f * k > 14000: break
        x += np.sin(2 * np.pi * f * (1 + det) * k * t) / k
    return x * .55
def stereo(x, w=.0006): d = int(w * SR); return np.stack([x, np.concatenate([np.zeros(d), x[:-d]]) if d else x], 1)
def bass(m, d, vel=.8, cut=420):
    f = hz(m); x = np.sin(2 * np.pi * f * tv(d)) * .9 + saw(f, d, nh=12) * .55
    x = lpf(x, cut) + .14 * np.tanh(3 * lpf(x, 900))            # 2、3 次谐波：小喇叭上也听得见
    return x * adsr(d, .01, min(.2, d * .4)) * vel * .8
def pad(ms, d, vel=.25, cut=1500, a=.8, r=1.0):
    x = np.zeros(int(d * SR))
    for m in ms:
        for det in (-.003, 0, .0037): x += saw(hz(m), d, det, nh=20)
    return (lpf(x, cut) * .75 + lpf(x, cut * .5) * .25) * adsr(d, a, r) * vel / max(1, len(ms))
def metal_ring(m, vel=.5, d=2.4):
    t = tv(d); f = hz(m)
    return sum(a * np.sin(2 * np.pi * f * r * t + rng.random() * 6) * np.exp(-t / tau) for r, a, tau in [(1, 1, 1.2), (2.76, .5, .7), (5.4, .3, .4), (8.93, .15, .25)]) * vel * .5
def punch(vel=1.0, d=.9):
    t = tv(d)
    b1 = np.sin(2 * np.pi * np.cumsum(70 * (1 + 1.2 * np.exp(-t / .025))) / SR) * np.exp(-t / .24)
    b2 = np.sin(2 * np.pi * np.cumsum(105 * (1 + .8 * np.exp(-t / .02))) / SR) * np.exp(-t / .14) * .6
    kn = bpf(rng.standard_normal(len(t)), 90, 400) * np.exp(-t / .045) * .7
    y = b1 + b2 + kn; return (y + .25 * np.tanh(2.5 * y)) * vel

# —— 材质的声音 ——
def tick_alu(v=1.0):
    """拉丝铝片落定：极短瞬态 + 高频金属共振（非谐）"""
    d = .07; t = tv(d); p = .92 + rng.random() * .16
    tr = hpf(rng.standard_normal(len(t)), 3000) * np.exp(-t / .0012)
    res = sum(a * np.sin(2 * np.pi * f * p * t + rng.random() * 6) * np.exp(-t / tau) for f, a, tau in [(3150, .5, .02), (5230, .35, .014), (7480, .25, .009), (1870, .2, .012)])
    return (tr * .7 + res) * v
def tok_acr(v=1.0):
    """亚克力片落定：更闷、更短的塑料声"""
    d = .06; t = tv(d); p = .9 + rng.random() * .2
    tr = bpf(rng.standard_normal(len(t)), 900, 5000) * np.exp(-t / .0018)
    res = sum(a * np.sin(2 * np.pi * f * p * t + rng.random() * 6) * np.exp(-t / tau) for f, a, tau in [(1450, .6, .012), (2650, .35, .008), (520, .3, .015)])
    return (tr * .6 + res) * v
def air(d, v=1.0, f0=500, f1=2600):
    n = rng.standard_normal(int(d * SR)); out = np.zeros_like(n); blk = 256
    for i in range(0, len(n), blk):
        u = i / len(n); f = f0 * (f1 / f0) ** np.sin(np.pi * u * .5)
        s = max(0, i - 3000); y = sosfilt(sos('band', [f * .7, min(f * 1.4, SR * .45)]), n[s:i + blk]); out[i:i + blk] = y[-(min(blk, len(n) - i)):]
    return out * np.sin(np.pi * np.clip(tv(d) / d, 0, 1)) ** 2 * v

PENTA = ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6', 'A6', 'B6']
GLASS = ['A#4', 'D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6']

def foley():
    for e in EV:
        t, ty = e['t'], e['type']
        if ty == 'riffle':
            n, d = e['n'], e['d']; dens = n / max(d, .05)
            g = .55 / np.sqrt(max(1.0, dens / 12))
            for k in range(n):
                tl = t + d * ((k + 1) / n) ** .85
                x = tick_alu(.9) if e['mat'] == 'sol' else tok_acr(.9)
                put(FX, x, tl, g * (.75 + .25 * rng.random()), .25 if e['mat'] == 'sol' else -.25)
            put(FX, air(min(.5, d + .15), .5, 2500, 6000), t - .05, .05)
        elif ty == 'brass':
            h = int(e['h']) - 1
            if e['mat'] == 'sol': inst(FX, t, 'glockenspiel', PENTA[h % len(PENTA)], .6, .45, .26, .3)
            else: inst(FX, t, 'glass', GLASS[h % len(GLASS)], .8, .5, .32, -.3)
            put(FX, metal_ring(mi('D7') - 12 + (h % 5) * 2, .2, .6), t, .08)
        elif ty == 'drop':
            put(FX, tick_alu(1.0) * 1.0 + lpf(tick_alu(.6), 1800) * .6, t, .5, .15)
        elif ty == 'whoosh':
            put(FX, stereo(air(e['d'], e.get('v', .6), 380, 1800)), t, .35)
        elif ty == 'verdict':
            inst(HIT, t, 'vibraphone_hard', 'A5', 1.2, .5, .5, .2); inst(HIT, t, 'vibraphone', 'D5', 1.6, .45, .45, -.2)
        elif ty == 'turn':
            # 交汇：低音 D 的一记（大鼓 + 定音鼓 + 冲击体），圆号 D 大调和弦，钟琴点亮
            put(HIT, stereo(punch(1.0)), t, .9)
            inst(HIT, t, 'bass_drum', None, None, .9, .8); inst(HIT, t, 'timpani', 'D3', 2.2, .9, .9)
            for m, p in (('D3', -.3), ('F#3', 0), ('A3', .3)): inst(HIT, t, 'horn', m, 2.4, .8, .55, p)
            inst(HIT, t, 'trombone', 'D2', 2.0, .8, .5)
            inst(HIT, t + .02, 'glockenspiel', 'F#6', 1.2, .6, .35, .4)
            put(HIT, metal_ring(mi('D5'), .5, 2.6), t, .25)
        elif ty == 'land25':
            inst(HIT, t, 'vibraphone_hard', 'D5', 1.8, .6, .45, -.2); inst(HIT, t, 'vibraphone_hard', 'F#5', 1.8, .55, .4, .1); inst(HIT, t, 'vibraphone_hard', 'A5', 1.8, .55, .4, .3)
            inst(HIT, t, 'timpani', 'D3', 1.4, .45, .5)
        elif ty == 'puck':
            # 最后一件实物：黄铜圆片落在盘心——全片最重的一下
            put(HIT, stereo(punch(1.2)), t, 1.0)
            inst(HIT, t, 'bass_drum', None, None, 1.0, .9); inst(HIT, t, 'gran_cassa', 'hit', None, .9, .6); inst(HIT, t, 'timpani', 'D3', 3.0, 1.0, .9)
            inst(HIT, t, 'tubular_bells', 'D5', 4.0, .8, .6, .15); inst(HIT, t, 'tubular_bells', 'A4', 4.0, .6, .4, -.2)
            put(HIT, metal_ring(mi('D4'), .9, 4.0), t, .35); put(HIT, metal_ring(mi('A4') + .1, .4, 3.0), t, .35)
            put(FX, tick_alu(1.0), t, .9)
            for k in range(5): put(FX, tick_alu(.5 / (k + 1)), t + .07 + k * .055 * (1 - k * .1), .4)   # 圆片在木头上的细小回弹
        elif ty == 'end':
            inst(HIT, t, 'harp', 'D4', 3, .45, .45, -.3)

def score():
    # 和声：每小节一和弦；D 大调
    CH = {0: ['D3', 'A3', 'E4'], 1: ['D3', 'A3', 'E4'], 2: ['B2', 'F#3', 'D4'], 3: ['G2', 'D3', 'F#4'],
          4: ['D3', 'A3', 'F#4'], 5: ['C#3', 'A3', 'E4'], 6: ['B2', 'F#3', 'D4'], 7: ['G2', 'D3', 'A3'], 8: ['A2', 'D3', 'E4'],
          9: ['D3', 'A3', 'F#4'], 10: ['B2', 'F#3', 'D4'], 11: ['G2', 'D3', 'B3'], 12: ['A2', 'E3', 'C#4'], 13: ['G2', 'D3', 'F#4'],
          14: ['D3', 'A3', 'F#4'], 15: ['D3', 'A3', 'F#4']}
    ROOT = {b: ch[0] for b, ch in CH.items()}
    # 1) 铺底：低音合成 pad + 弓奏颤音琴（只放 A3 以上）
    for b in range(16):
        t = q(b); d = BAR + .4
        if b == 8: d = BAR * .7                                            # 交汇前那一小节收短：留出抽空
        put(MUS, stereo(pad([mi(n) for n in CH[b]], d, .3 if b < 4 else .36, 1300 if b < 9 else 1900)), t, .9)
        top = [n for n in CH[b] if mi(n) >= mi('A3')]
        for n in top: inst(MUS, t, 'vibraphone_bowed', n, d, .4, .35, rng.uniform(-.4, .4), attack=.3)
    # 2) 开场两小节：风的音色——玻璃杯琴 + 竖琴的稀疏动机（风电领先）
    for i, (b, bt, n) in enumerate([(0, 1, 'A5'), (0, 3, 'F#5'), (1, 0, 'E5'), (1, 2, 'D5'), (2, 0, 'F#5'), (2, 2, 'E5'), (3, 0, 'D5')]):
        inst(MUS, q(b, bt), 'glass', n, 1.4, .45, .4, -.3 + .1 * i)
        inst(MUS, q(b, bt), 'harp', n[:-1] + str(int(n[-1]) - 1), 1.4, .35, .25, .3)
    # 3) 增长段起脉冲：合成低音（四分 → 八分）+ 马林巴琶音（八分 → 十六分），用细分加速，不改速度
    for b in range(4, 15):
        if b == 8: continue
        sub = 1 if b < 9 else .5
        k = 0
        while k * sub < 4:
            t = q(b, k * sub)
            if not (b == 13 and k * sub >= 2):                            # 圆片落下前抽空
                put(PUL, stereo(bass(mi(ROOT[b]) - 12 + (12 if ROOT[b][-1] == '1' else 0), BEAT * sub * .9, .55 if (k * sub) % 1 == 0 else .4)), t, 1.0)
            k += 1
        arp = [mi(n) + 12 for n in CH[b]] + [mi(CH[b][1]) + 24]
        div = .5 if b < 9 else .25
        if b >= 12: div = .5
        k = 0
        while k * div < 4:
            if b == 13 and k * div >= 2: break
            m = arp[k % len(arp)]
            if b in (12, 14): m = arp[(k * 3) % len(arp)]
            inst(PUL, q(b, k * div), 'marimba', int(m), .4, .42 if k % 2 == 0 else .3, .5, .35 if k % 2 else -.35)
            k += 1
    # 4) 交汇小节（8）：只留定音鼓心跳与悬挂和弦，在抽空前停住
    for bt in (0, 2): inst(PUL, q(8, bt), 'timpani', 'A2', 1.0, .4, .5)
    inst(MUS, q(7, 2), 'horn', 'A3', BAR * .9, .35, .3, -.2, attack=.4)
    # 5) 2025 落片段：钟琴在落片上方唱一条往上的旋律（每两拍一音）
    for i, n in enumerate(['D6', 'E6', 'F#6', 'A6', 'B6', 'A6']):
        inst(MUS, T['drop25'] + i * BEAT * 1, 'glockenspiel', n, .8, .4, .22, .2)
    # 6) 表盘：圆号与大提琴的宽和弦，竖琴琶音收尾
    for n, p in (('D3', -.3), ('A3', 0), ('F#4', .3)): inst(MUS, q(12, 0), 'horn', n, BAR * 1.5, .5, .32, p, attack=.5)
    inst(MUS, q(12, 0), 'cellos', 'D3', BAR * 1.5, .45, .3, -.2, attack=.6)
    for i, n in enumerate(['D4', 'F#4', 'A4', 'D5', 'E5', 'F#5', 'A5', 'D6']):
        inst(MUS, T['puck'] + .9 + i * BEAT * .5, 'harp', n, 2.4, .45, .45, -.3 + .08 * i)
    inst(MUS, q(14, 2), 'vibraphone_bowed', 'D5', 4.0, .45, .4, 0, attack=.4)
    inst(MUS, q(14, 2), 'vibraphone_bowed', 'A4', 4.0, .4, .35, 0, attack=.4)

def bed():
    # 棚里的空气：很轻的粉噪 + 低频房间音
    n = rng.standard_normal(N); b = lpf(np.cumsum(n) / 200, 300)
    air_ = lpf(hpf(n, 200), 3000)
    x = (b / (np.abs(b).max() + 1e-9) * .4 + air_ / (np.abs(air_).max() + 1e-9) * .25)
    BED[:] += stereo(x)[:N] * .5

def voice():
    for v in TL['VO']:
        x, sr = sf.read(os.path.join(HERE, 'voice/out', v['id'] + '.wav'))
        if x.ndim > 1: x = x.mean(1)
        x = soxr.resample(x, sr, SR); x = hpf(x, 90)
        x = X.compress(x / (np.abs(x).max() + 1e-9) * .9, thr=.22, ratio=3.2, att=.003, rel=.09)
        put(VOX, stereo(x, .0002), v['t'])

def lufs(x):
    import subprocess, tempfile, re
    f = os.path.join(tempfile.mkdtemp(), 'm.wav'); sf.write(f, x.astype(np.float32), SR)
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    import re as _r; return float(_r.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1])
def true_peak(x): return float(np.abs(soxr.resample(x, SR, 4 * SR)).max())
def tp_limit(x, ceil):
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    up = np.abs(soxr.resample(x, SR, 4 * SR)).max(1); n = len(x)
    pk = np.pad(up, (0, max(0, n * 4 - len(up))))[:n * 4].reshape(-1, 4).max(1)
    g0 = np.minimum(1.0, ceil / np.maximum(pk, 1e-9)); look = int(.004 * SR)
    g = uniform_filter1d(-maximum_filter1d(-g0, 2 * look + 1), look); g = np.minimum(g, -maximum_filter1d(-g0, 3))
    return x * g[:, None]
def rms(x): return float(np.sqrt(np.mean(x ** 2) + 1e-12))

def main():
    score(); foley(); bed(); voice()
    from scipy.ndimage import uniform_filter1d, maximum_filter1d
    mus = S.room(MUS, .6, .24); pul = S.room(PUL, .35, .15); hit = S.room(HIT, .7, .26); fx = S.room(FX, .25, .1)
    v = np.abs(VOX).mean(1)
    env = uniform_filter1d(maximum_filter1d(v, int(.12 * SR)), int(.15 * SR)); env = np.clip(env / (env.max() + 1e-9) * 3, 0, 1)
    # 抽空：交汇判定前、圆片落下前，音乐和音效一起掉下去，冲击落在抽空之后
    for a_, b_ in ((T['suck'], T['verdict21'] - .01), (T['suck2'], T['puck'] - .01)):
        i0, i1 = int(a_ * SR), int(b_ * SR); f = int(.08 * SR)
        g = np.ones(N); g[i0:i0 + f] = np.linspace(1, .03, f); g[i0 + f:i1] = .03
        for buf in (mus, pul, fx): buf *= g[:, None]
        hit *= np.where(np.arange(N)[:, None] < i1, np.maximum(g, .2)[:, None], 1)
    speaking = env > .5
    vr = rms(VOX[speaking])
    def act(x):
        m = x.mean(1); w = int(.05 * SR); n_ = len(m) // w; r = np.sqrt((m[:n_ * w].reshape(n_, w) ** 2).mean(1)); on = r > r.max() * .03
        return float(np.sqrt((r[on] ** 2).mean()))
    # 电平：音乐（铺底 + 脉冲）在旁白下约 10 dB，音效约 −7 dB，冲击与人声相当；床 −24 dB
    g_mus = vr / act(mus) * 10 ** (-9.5 / 20); g_pul = vr / act(pul) * 10 ** (-10.5 / 20)
    g_fx = vr / act(fx) * 10 ** (-8 / 20); g_hit = vr / act(hit) * 10 ** (-3 / 20); g_bed = vr / act(BED) * 10 ** (-27 / 20)
    duck = lambda k: (1 - k * env)[:, None]
    stems = {'music': mus * g_mus * duck(.4), 'pulse': pul * g_pul * duck(.3), 'fx': fx * g_fx * duck(.15), 'hits': hit * g_hit, 'beds': BED * g_bed, 'voice': VOX}
    shelf = 10 ** (-5 / 20)
    for k in ('music', 'pulse', 'hits', 'beds', 'fx'):
        x = hpf(stems[k], 44 if k == 'hits' else 36, 4 if k == 'hits' else 2); stems[k] = x - (1 - shelf) * lpf(x, 62, 2)
    bus = stems['music'] + stems['pulse'] + stems['fx'] + stems['beds']
    lvl = np.sqrt(uniform_filter1d((bus ** 2).max(1), int(.012 * SR))); thr = 10 ** (-12 / 20) * np.percentile(lvl, 99.9)
    g = np.where(lvl > thr, (thr + (lvl - thr) / 2.5) / np.maximum(lvl, 1e-9), 1.0); g = uniform_filter1d(-maximum_filter1d(-g, int(.008 * SR)), int(.03 * SR))
    mix = (bus * g[:, None] + stems['hits'] + stems['voice'])[:int(DUR * SR)]
    fade = int(.6 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
    for _ in range(3):
        I = lufs(mix); mix = mix * 10 ** ((-14.4 - I) / 20); mix = tp_limit(mix, 10 ** (-4.6 / 20))
    print(f'master: {lufs(mix):.2f} LUFS, true peak {20 * np.log10(true_peak(mix)):.2f} dBTP')
    os.makedirs(os.path.join(HERE, 'out/stems'), exist_ok=True)
    sf.write(os.path.join(HERE, 'out/mix.wav'), mix.astype(np.float32), SR)
    for name, b in stems.items(): sf.write(os.path.join(HERE, 'out/stems', name + '.wav'), b[:int(DUR * SR)].astype(np.float32), SR)
    for k in ('music', 'pulse', 'fx', 'hits', 'beds'):
        print(f'  {k:6s} {20 * np.log10(act(stems[k][:int(DUR * SR)]) / vr):+.1f} dB vs voice')
    json.dump(sorted(USED), open(os.path.join(HERE, 'out/instruments.json'), 'w'))
    print('instruments:', ', '.join(sorted(USED)))
    for line in S.credits(sorted(USED)): print('  credit:', line)

if __name__ == '__main__':
    main()
