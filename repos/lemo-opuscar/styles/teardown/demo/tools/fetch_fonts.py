# Fonts (all SIL OFL 1.1, from Google Fonts): Noto Sans SC subset to the characters the overlay uses (CSS API text=),
# Inter and JetBrains Mono as variable TTFs from github.com/google/fonts, plus their licence texts
# usage: python3 -I tools/fetch_fonts.py   (run from the film folder; needs network)
import re, urllib.parse, urllib.request, pathlib
here = pathlib.Path(__file__).resolve().parent.parent
src = ''.join(p.read_text() for p in (here / 'src').glob('*.js'))
chars = ''.join(sorted(set(c for c in src if ord(c) > 0x2000 and not c.isspace())))
chars += '0123456789.·×mmRPKBYC() '
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'
for w in (400, 500):
    url = f'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@{w}&text=' + urllib.parse.quote(chars)
    css = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30).read().decode()
    furl = re.search(r'url\((https://[^)]+)\)', css).group(1)
    (here / 'fonts').mkdir(exist_ok=True)
    (here / 'fonts' / f'NotoSansSC-{w}.woff2').write_bytes(urllib.request.urlopen(furl, timeout=30).read())
print(len(chars), 'chars:', chars)

GF = 'https://github.com/google/fonts/raw/main/ofl/'
for url, name in [(GF + 'inter/Inter%5Bopsz,wght%5D.ttf', 'Inter.ttf'), (GF + 'inter/OFL.txt', 'OFL-inter.txt'),
                  (GF + 'jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf', 'JetBrainsMono.ttf'), (GF + 'jetbrainsmono/OFL.txt', 'OFL-jetbrainsmono.txt'),
                  (GF + 'notosanssc/OFL.txt', 'OFL-notosanssc.txt')]:
    (here / 'fonts' / name).write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60).read())
print('fonts ready in', here / 'fonts')
