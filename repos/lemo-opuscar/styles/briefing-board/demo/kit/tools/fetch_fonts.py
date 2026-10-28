#!/usr/bin/env python3
"""Fetch every font the page uses from Google Fonts (all SIL Open Font License 1.1) into kit/fonts/.

    python3 kit/tools/fetch_fonts.py [scenes/film.json …] [--latin-only]

- Latin faces, whole files from github.com/google/fonts (ofl/): Archivo (variable, wdth + wght) as
  Archivo-VF.ttf, IBM Plex Mono Medium / SemiBold; plus each family's OFL.txt.
- Chinese faces, subset to the characters the scenes use: LXGW Marker Gothic 400 (marker lettering) and
  Noto Sans SC 500 / 700 / 900 (subtitles, tags, stamp, cards), through the Google Fonts CSS API with
  &text= (a few kB each instead of megabytes). Run it again when the words change.
Characters are collected from tags, marker lettering, stamps, cards and subtitles of the scene files
(default: scenes/film.json). Needs a network connection; standard library only.
"""
import json, os, sys, urllib.parse, urllib.request, re

HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE); FD = os.path.join(KIT, 'fonts')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'
GF = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'
LATIN = {'Archivo-VF.ttf': 'archivo/Archivo%5Bwdth,wght%5D.ttf',
         'IBMPlexMono-Medium.ttf': 'ibmplexmono/IBMPlexMono-Medium.ttf',
         'IBMPlexMono-SemiBold.ttf': 'ibmplexmono/IBMPlexMono-SemiBold.ttf'}
LICENCES = {'OFL-Archivo.txt': 'archivo', 'OFL-IBMPlexMono.txt': 'ibmplexmono',
            'OFL-LXGWMarkerGothic.txt': 'lxgwmarkergothic', 'OFL-NotoSansSC.txt': 'notosanssc'}
BASE = '0123456789,.:;!?()-–—+×·%米 ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz，。：；！？、（）“”'

def get(url, timeout=60):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=timeout).read()

def chars(scene_files):
    s = set(BASE)
    for f in scene_files:
        d = json.load(open(f))
        for e in d.get('elements', []):
            if isinstance(e.get('text'), str): s |= set(e['text'])
            for l in e.get('lines', []) or []:
                if isinstance(l.get('text'), str): s |= set(l['text'])
        for q in d.get('subs', []):
            s |= set(q.get('zh', '')) | set(q.get('en', ''))
    return ''.join(sorted(c for c in s if c.strip()))

def subset(family, weight, text, out):
    q = f'https://fonts.googleapis.com/css2?family={family.replace(" ", "+")}:wght@{weight}&text={urllib.parse.quote(text)}'
    url = re.search(r'url\((https://[^)]+)\)', get(q, 30).decode()).group(1)
    data = get(url); open(out, 'wb').write(data); print(out, len(data), 'bytes')

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    os.makedirs(FD, exist_ok=True)
    for name, path in {**LATIN, **{k: v + '/OFL.txt' for k, v in LICENCES.items()}}.items():
        out = os.path.join(FD, name)
        if not os.path.exists(out):
            data = get(GF + path); open(out, 'wb').write(data); print(out, len(data), 'bytes')
    if '--latin-only' in sys.argv: sys.exit(0)
    files = args or [os.path.join(os.path.dirname(KIT), 'scenes', 'film.json')]
    txt = chars(files); print(len(txt), 'characters')
    subset('LXGW Marker Gothic', 400, txt, os.path.join(FD, 'LXGWMarkerGothic-sub.woff2'))
    for w in (500, 700, 900):
        subset('Noto Sans SC', w, txt, os.path.join(FD, f'NotoSansSC-{w}-sub.woff2'))
    open(os.path.join(FD, 'chars.txt'), 'w').write(txt)
