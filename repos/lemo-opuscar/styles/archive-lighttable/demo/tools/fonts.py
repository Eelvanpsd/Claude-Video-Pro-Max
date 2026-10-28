"""Every font the page uses, fetched from Google Fonts (all SIL OFL 1.1) into fonts/:
Noto Sans SC 400/500/600 and Noto Serif SC 600 subset to the characters in film.js + timeline.js (CSS2 API, &text=);
IBM Plex Sans 400/500 and IBM Plex Mono 400/500 for Latin (subset to printable ASCII + a few signs);
the licence texts from github.com/google/fonts. usage: python -I tools/fonts.py <demo_dir>"""
import sys, os, re, urllib.request, urllib.parse
D = sys.argv[1]
src = ''.join(open(os.path.join(D, f), encoding='utf-8').read() for f in ('film.js', 'timeline.js'))
cjk = sorted(set(re.findall(r'[　-〿一-鿿＀-￯·×→−—]', src)))
latin = ''.join(chr(c) for c in range(32, 127))
text = ''.join(cjk) + latin
print(len(cjk), 'CJK chars:', ''.join(cjk))
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}), timeout=60).read()
for fam, w, out, txt in (('Noto Sans SC', 400, 'NotoSansSC-400.woff2', text), ('Noto Sans SC', 500, 'NotoSansSC-500.woff2', text), ('Noto Sans SC', 600, 'NotoSansSC-600.woff2', text),
                         ('Noto Serif SC', 600, 'NotoSerifSC-600.woff2', text),
                         ('IBM Plex Sans', 400, 'IBMPlexSans-400.woff2', latin + '·×→−—’'), ('IBM Plex Sans', 500, 'IBMPlexSans-500.woff2', latin + '·×→−—’'),
                         ('IBM Plex Mono', 400, 'IBMPlexMono-400.woff2', latin + '·×→−—’'), ('IBM Plex Mono', 500, 'IBMPlexMono-500.woff2', latin + '·×→−—’')):
    css = get('https://fonts.googleapis.com/css2?family=' + urllib.parse.quote(fam) + f':wght@{w}&text=' + urllib.parse.quote(txt)).decode()
    urls = re.findall(r'url\((https://[^)]+)\)', css)
    assert len(urls) == 1, css[:400]
    data = get(urls[0]); open(os.path.join(D, 'fonts', out), 'wb').write(data)
    print(out, len(data), 'bytes')
for fam, out in (('ibmplexmono', 'OFL-ibmplexmono.txt'), ('ibmplexsans', 'OFL-ibmplexsans.txt'),
                 ('notosanssc', 'OFL-notosanssc.txt'), ('notoserifsc', 'OFL-notoserifsc.txt')):
    open(os.path.join(D, 'fonts', out), 'wb').write(get(f'https://raw.githubusercontent.com/google/fonts/main/ofl/{fam}/OFL.txt'))
print('licence texts written')
