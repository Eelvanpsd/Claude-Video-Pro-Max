# Picture checks on the final film: blank or NaN-block frames, and motion per second.
# usage: python -I tools/motioncheck.py <film.mp4>
# A NaN pixel in the 3D pass becomes a black square after bloom: we look for 64 px tiles that are pure black
# away from the vignetted corners. Motion = mean absolute change between consecutive frames (480×270 luma).
import sys, subprocess, numpy as np
f = sys.argv[1]
W, H = 480, 270
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-vf', f'scale={W}:{H},format=gray', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.int16)
big = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-vf', 'format=gray', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
full = np.frombuffer(big, np.uint8).reshape(-1, 1080, 1920)
# a tile that is pure black in one frame but lit in the frames on both sides (dark props stay dark across frames)
tiles = np.stack([a[64:1024, 128:1792].reshape(15, 64, 26, 64).max(axis=(1, 3)) for a in full])
bad = [i for i in range(1, len(tiles) - 1) if ((tiles[i] < 3) & (tiles[i - 1] > 20) & (tiles[i + 1] > 20)).any()]
d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
fps = 24; per = [d[i * fps:(i + 1) * fps].mean() for i in range(len(d) // fps)]
jump = max(d[i] / max(.25, np.median(d[max(0, i - 3):i + 4])) for i in range(len(d)))
print(f'frames {len(fr)}  black/NaN-block frames: {bad[:10] if bad else "none"}')
print('motion per second: ' + ' '.join(f'{x:.1f}' for x in per))
print(f'slowest second {min(per):.2f}, fastest {max(per):.2f}, worst single-frame jump ratio {jump:.2f}')
sys.exit(1 if bad else 0)
