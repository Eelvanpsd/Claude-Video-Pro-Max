"""Fetch every font the page uses from Google Fonts (github.com/google/fonts, OFL) if missing, and subset
Noto Sans SC (variable) to the characters in film.js and timeline.js.
usage: fonts.py <demo_dir>   -> fonts/*.ttf, fonts/NotoSansSC-sub.woff2 (source CJK font cached in assets/raw/fonts/)"""
import os, sys, urllib.request
from fontTools import subset
D = sys.argv[1]
GF = "https://github.com/google/fonts/raw/main/ofl/"
FILES = {   # local path (relative to the demo) -> Google Fonts path
    "fonts/BarlowCondensed-Light.ttf": "barlowcondensed/BarlowCondensed-Light.ttf",
    "fonts/BarlowCondensed-Regular.ttf": "barlowcondensed/BarlowCondensed-Regular.ttf",
    "fonts/BarlowCondensed-Medium.ttf": "barlowcondensed/BarlowCondensed-Medium.ttf",
    "fonts/IBMPlexMono-Regular.ttf": "ibmplexmono/IBMPlexMono-Regular.ttf",
    "fonts/IBMPlexMono-Medium.ttf": "ibmplexmono/IBMPlexMono-Medium.ttf",
    "assets/raw/fonts/NotoSansSC.ttf": "notosanssc/NotoSansSC%5Bwght%5D.ttf",
}
for rel, src in FILES.items():
    p = os.path.join(D, rel)
    if os.path.exists(p) and os.path.getsize(p) > 10000: continue
    os.makedirs(os.path.dirname(p), exist_ok=True)
    b = urllib.request.urlopen(GF + src, timeout=300).read()
    if len(b) < 10000: raise SystemExit(f"font download failed: {GF + src}")
    open(p, "wb").write(b); print("fetched", rel, len(b), "bytes")
chars = set()
for f in ("film.js", "timeline.js"):
    chars |= set(open(os.path.join(D, f), encoding="utf-8").read())
chars |= set(chr(c) for c in range(32, 127)) | set("·→°²×−▸—“”")
text = "".join(sorted(c for c in chars if ord(c) >= 32))
o = subset.Options(); o.flavor = "woff2"; o.layout_features = ["*"]
font = subset.load_font(os.path.join(D, "assets/raw/fonts/NotoSansSC.ttf"), o)
s = subset.Subsetter(o); s.populate(text=text); s.subset(font)
subset.save_font(font, os.path.join(D, "fonts/NotoSansSC-sub.woff2"), o); print("NotoSansSC-sub.woff2", len(text), "chars")
