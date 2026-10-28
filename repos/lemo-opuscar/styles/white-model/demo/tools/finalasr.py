"""Speech-to-text on the final film (music, foley and all): every narration line must come back verbatim.
usage: python -I tools/finalasr.py <film.mp4> <demo_dir> [model=small.en]"""
import sys, os, json, re, subprocess, tempfile
from faster_whisper import WhisperModel
mp4, D = sys.argv[1], sys.argv[2]; model = sys.argv[3] if len(sys.argv) > 3 else 'small.en'
wav = os.path.join(tempfile.mkdtemp(), 'mix16k.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp4, '-ac', '1', '-ar', '16000', wav], check=True)
segs, _ = WhisperModel(model, device='cpu', compute_type='int8').transcribe(wav, language='en', vad_filter=False)
heard = ' '.join(s.text for s in segs)
print('heard:', heard.strip())
norm = lambda s: re.sub(r'[^a-z0-9 ]', ' ', s.lower().replace('centre', 'center').replace('metres', 'meters').replace('nine', '9')).split()
H = norm(heard); bad = 0
for L in json.load(open(os.path.join(D, 'voice/lines.json'))):
    exp = norm(L.get('asr') or L['text'])
    ok = any(H[i:i + len(exp)] == exp for i in range(len(H) - len(exp) + 1)); bad += not ok
    print(('OK   ' if ok else 'MISS ') + ' '.join(exp))
print('all lines heard in the final mix' if not bad else f'{bad} line(s) not heard verbatim')
