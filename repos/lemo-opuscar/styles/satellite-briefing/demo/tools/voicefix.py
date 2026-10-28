"""Trim TTS artefacts after synthesis. Kokoro sometimes over-aspirates a final stop: in "Someone kept it."
the released t becomes a small extra syllable that speech-to-text hears as "too". Cut it with a short fade.
usage: python -I tools/voicefix.py <demo_dir>"""
import sys, os, json
import numpy as np, soundfile as sf
D = sys.argv[1]
FIX = {'l10': 1.035}          # seconds to keep (end of the closure of "it" + a little release)
dur = json.load(open(os.path.join(D, 'voice/out/dur.json')))
for k, keep in FIX.items():
    p = os.path.join(D, 'voice/out', k + '.wav'); x, sr = sf.read(p)
    n = int(keep * sr)
    if len(x) > n:
        x = x[:n].copy(); f = int(.035 * sr); x[-f:] *= np.linspace(1, 0, f) ** 2
        sf.write(p, x, sr); dur[k] = round(len(x) / sr, 3); print(k, 'trimmed to', dur[k])
json.dump(dur, open(os.path.join(D, 'voice/out/dur.json'), 'w'), indent=1)
