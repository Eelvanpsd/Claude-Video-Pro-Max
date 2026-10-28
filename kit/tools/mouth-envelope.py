"""Per-frame mouth openness (0-1) from a voice file, for talking characters.
Usage: python3 kit/tools/mouth-envelope.py voice.wav [mouth.json] [--fps 30]   (needs ffmpeg)
Output: JSON array, one value per frame. In Remotion: mouth={env[frame]}.

Normalised to the 95th-percentile frame (one loud syllable doesn't shrink the rest) with a small
floor so breaths and room noise keep the mouth shut. Idea: yapaytu/reels-sistemi `araclar/genlik.py` (MIT)."""
import array
import json
import math
import subprocess
import sys

args = [a for a in sys.argv[1:]]
fps = 30
if "--fps" in args:
    i = args.index("--fps")
    fps = int(args[i + 1])
    del args[i:i + 2]
if not args:
    sys.exit(__doc__)
out = args[1] if len(args) > 1 else "mouth.json"
SR = 24000
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", args[0], "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                     capture_output=True, check=True).stdout
x = array.array("h", raw)
hop = SR // fps
rms = [math.sqrt(sum(v * v for v in x[i:i + hop]) / max(1, len(x[i:i + hop]))) / 32768 for i in range(0, len(x), hop)]
peak = sorted(rms)[int(len(rms) * 0.95)] or 1
env = [round(min(1, max(0, (r / peak - 0.08) * 1.1)), 2) for r in rms]
with open(out, "w") as f:
    json.dump(env, f)
print(f"{len(env)} frames ({len(env) / fps:.1f} s) -> {out}")
