#!/usr/bin/env python3
"""Download the source photos the demo's cut-outs are made from, as recorded in
sources/candidates/candidates.json (every entry with "used": true): original_url → sources/candidates/<file>.

    python3 kit/tools/fetch_sources.py [--all]

Each record already holds the Commons page, author, licence and the licence evidence (the file page's
template); this script prints them as it goes. Files that exist are kept; a recorded sha256 is checked
(a mismatch is only a warning: Commons files can be re-uploaded). About 470 MB, two Library of Congress
TIFFs being most of it. --all also fetches the candidates that were looked at but not used.
Standard library only.
"""
import hashlib, json, os, sys, urllib.request, time

HERE = os.path.dirname(os.path.abspath(__file__)); DEMO = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(DEMO, 'sources', 'candidates')
UA = 'LemoOpuscar-demo-fetch/1.0 (https://github.com/lemomo-ai/lemo-opuscar; library demo rebuild)'

def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()

def fetch(url, out):
    tmp = out + '.part'
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=120) as r, open(tmp, 'wb') as f:
                while True:
                    b = r.read(1 << 20)
                    if not b: break
                    f.write(b)
            os.replace(tmp, out); return
        except Exception as e:
            print('  retry', attempt + 1, e); time.sleep(5 * (attempt + 1))
    raise SystemExit(f'could not download {url}')

if __name__ == '__main__':
    recs = json.load(open(os.path.join(SRC, 'candidates.json')))
    for r in recs:
        if not (r.get('used') or '--all' in sys.argv): continue
        out = os.path.join(SRC, r['file']); os.makedirs(os.path.dirname(out), exist_ok=True)
        print(f"{r['file']}: {r['license']} · {r['author']} · {r['commons_url']}")
        if not os.path.exists(out):
            fetch(r['original_url'], out)
        if r.get('sha256') and sha256(out) != r['sha256']:
            print(f"  WARNING: {r['file']} differs from the recorded file (sha256); the cut-out parameters may need a look")
    print('sources ready in', SRC)
