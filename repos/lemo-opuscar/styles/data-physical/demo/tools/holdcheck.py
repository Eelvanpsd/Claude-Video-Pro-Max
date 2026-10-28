"""比较停稳检查：每一组比较（2014 一对、2020/2021 两对）的读数完整入画后，到判定出现之前至少停 2.5 s。
读 readcheck 的逐帧文字记录不方便，这里直接用 timeline 的时间点（画面代码里读数和判定都由这些时间点驱动）。"""
import json, os, sys
d = sys.argv[1]; T = json.load(open(os.path.join(d, 'out/timeline.json')))['T']
ok = True
for name, hold0, verdict in (('2014 wind vs solar', T['hold14'][0] + .35, T['verdict14']), ('2020/2021 four readings', T['hold21'][0] + .35, T['verdict21'])):
    h = verdict - hold0; ok &= h >= 2.5
    print(f"{'OK  ' if h >= 2.5 else 'SHORT'} {name}: readings fully in from {hold0:.2f} s, verdict at {verdict:.2f} s, held {h:.2f} s")
sys.exit(0 if ok else 1)
