"""Speech-to-text on the final film's mix (music and foley included): every line must still be heard.
usage: $LIB/.venv/bin/python tools/finalasr.py <film.mp4> <demo_dir>"""
import sys, os, json, subprocess, tempfile, re
from faster_whisper import WhisperModel
mp4, D = sys.argv[1], sys.argv[2]
wav = os.path.join(tempfile.mkdtemp(), 'a.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp4, '-ac', '1', '-ar', '16000', wav], check=True)
m = WhisperModel(os.environ.get('WHISPER_MODEL', 'small.en'), device='cpu', compute_type='int8')
segs, _ = m.transcribe(wav, language='en', word_timestamps=False)
heard = ' '.join(s.text for s in segs)
norm = lambda s: re.sub(r'[^a-z0-9. ]', ' ', s.lower()).split()
lines = json.load(open(os.path.join(D, 'voice/lines.json')))
H = ' '.join(norm(heard)); bad = 0
for L in lines:
    want = ' '.join(norm(L.get('asr', L['text']))).replace(' .', '').rstrip('.')
    ok = want.replace('.', '') in H.replace('.', '').replace(' 1 mm ', ' one millimeter ')
    words = set(norm(want)); got = len(words & set(norm(heard))) / max(1, len(words))
    ok = ok or got >= .85
    bad += not ok
    print(('OK  ' if ok else 'MISS'), f'{got:.2f}', L['id'], want)
print('heard:', heard.strip()); sys.exit(1 if bad else 0)
