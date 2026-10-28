"""Motion per frame (mean absolute difference of consecutive frames on a 240x135 grey copy): flags stretches over 1 s
where the picture barely moves, and cut-like jumps. usage: python -I tools/motioncheck.py <video.mp4> [flat=0.6]"""
import sys, subprocess
import numpy as np
v = sys.argv[1]; thr = float(sys.argv[2]) if len(sys.argv) > 2 else .6
W, H, fps = 240, 135, 24
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', v, '-vf', f'scale={W}:{H},format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
d = np.abs(np.diff(f, axis=0)).mean((1, 2))
print(f'frames {len(f)}  mean motion {d.mean():.2f}  median {np.median(d):.2f}')
line = [f'{s:2d}:{d[s * fps:(s + 1) * fps].mean():5.2f}' for s in range(len(d) // fps + 1) if len(d[s * fps:(s + 1) * fps])]
for i in range(0, len(line), 8): print('  '.join(line[i:i + 8]))
run, start, bad = 0, 0, []
for i, x in enumerate(np.append(d < thr, False)):
    if x:
        if run == 0: start = i
        run += 1
    else:
        if run > fps: bad.append((round(start / fps, 2), round((start + run) / fps, 2)))
        run = 0
print('flat stretches > 1 s:', bad or 'none')
print('cut-like jumps:', [(round((i + 1) / fps, 2), round(float(x), 1)) for i, x in enumerate(d) if x > max(12, 6 * np.median(d))][:30] or 'none')
