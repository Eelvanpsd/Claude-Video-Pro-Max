"""Fetch every font the page uses (all OFL, from Google Fonts):
  Latin  Barlow Condensed Light/Regular, IBM Plex Mono Regular/Medium  <- github.com/google/fonts ofl/
  CJK    Noto Sans SC 400/500, Noto Serif SC 600, subset to the characters in film.js + timeline.js (CSS2 API &text=)
usage: python -I tools/fonts.py <demo_dir>  -> fonts/*.ttf, fonts/*.woff2"""
import sys, os, re, urllib.request, urllib.parse
D = sys.argv[1]
src = ''.join(open(os.path.join(D, f), encoding='utf-8').read() for f in ('film.js', 'timeline.js'))
cjk = sorted(set(re.findall(r'[　-〿一-鿿＀-￯·×Øµ]', src)))
text = ''.join(cjk) + '0123456789%.,:;-+()/°=· ' + ''.join(chr(c) for c in range(65, 91)) + ''.join(chr(c) for c in range(97, 123))
print(len(cjk), 'chars:', ''.join(cjk))
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}), timeout=60).read()
os.makedirs(os.path.join(D, 'fonts'), exist_ok=True)
GH = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'
for rel in ('barlowcondensed/BarlowCondensed-Light.ttf', 'barlowcondensed/BarlowCondensed-Regular.ttf',
            'ibmplexmono/IBMPlexMono-Regular.ttf', 'ibmplexmono/IBMPlexMono-Medium.ttf'):
    data = get(GH + rel); open(os.path.join(D, 'fonts', rel.split('/')[1]), 'wb').write(data)
    print(rel.split('/')[1], len(data), 'bytes')
for fam, w, out in (('Noto Sans SC', 400, 'NotoSansSC-400.woff2'), ('Noto Sans SC', 500, 'NotoSansSC-500.woff2'), ('Noto Serif SC', 600, 'NotoSerifSC-600.woff2')):
    css = get('https://fonts.googleapis.com/css2?family=%s:wght@%d&text=%s' % (urllib.parse.quote(fam), w, urllib.parse.quote(text))).decode()
    urls = re.findall(r'url\((https://[^)]+)\)', css); assert len(urls) == 1, css[:300]
    data = get(urls[0]); open(os.path.join(D, 'fonts', out), 'wb').write(data)
    print(out, len(data), 'bytes')
