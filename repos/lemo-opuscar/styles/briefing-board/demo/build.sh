#!/bin/sh
# Engineering Briefing Board — "The Ship Decides": one-command build.
# fetch what git does not hold → voice (+ speech check) → scene → checks → picture → score and sound → subtitles → master → poster.
# From a clean clone (library set up with `setup.sh deps voice music`) the first run also downloads:
#   fonts (Google Fonts, OFL) → kit/fonts/                      kit/tools/fetch_fonts.py
#   the six source photos (Commons, licences in candidates.json) kit/tools/fetch_sources.py   (~470 MB)
#   a private venv demo/.venv (onnxruntime …) + the BiRefNet model kit/tools/kit_env.sh         (~970 MB unless cached)
#   and cuts every object again                                   kit/tools/rebuild_objects.sh  (~3 min)
#   the voice model and the freepats / vsco2ce / vcsl samples      tools/fetch.sh (library packs)
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
LIB=${LIB:-$(cd "$HERE/../../.." && pwd)}          # <repo>/films/<name>/demo or <repo>/styles/<slug>/demo
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the library folder"; exit 1; }
PY="$LIB/.venv/bin/python"
NAME=$(basename "$(dirname "$HERE")")
OUT="$HERE/.."
cd "$HERE"
# fetch / prepare only what is missing; every test keys on a git-ignored file
for f in Archivo-VF.ttf IBMPlexMono-Medium.ttf IBMPlexMono-SemiBold.ttf LXGWMarkerGothic-sub.woff2 NotoSansSC-500-sub.woff2 NotoSansSC-700-sub.woff2 NotoSansSC-900-sub.woff2; do
  [ -f "kit/fonts/$f" ] || { python3 kit/tools/fetch_fonts.py; break; }
done
for j in kit/objects/*.json; do [ -f "${j%.json}.png" ] || { sh kit/tools/rebuild_objects.sh; break; }; done
[ -f "$LIB/core/tts/kokoro-v1.0.onnx" ] && [ -f "$LIB/core/tts/voices-v1.0.bin" ] || (cd "$LIB" && sh tools/fetch.sh voice)
for l in freepats vsco2ce vcsl; do [ -d "$LIB/core/audio/instruments/$l" ] || (cd "$LIB" && sh tools/fetch.sh instruments $l); done
[ -f audio/vo/L9.wav ] || "$PY" "$LIB/core/tts/tts.py" audio/lines.json audio/vo
"$PY" "$LIB/core/tts/asr_check.py" audio/lines.json audio/vo --lang en
python3 scenes/_gen_film.py                                   # scenes/film.json + audio/cues.json
python3 tools/cuecheck.py
cd "$LIB"
node core/render/readcheck.mjs "$HERE" --step 0.05
node "$HERE/tools/camcheck.mjs"
node "$HERE/tools/rescheck.mjs"
node core/render/events.mjs "$HERE"
node core/render/video.mjs "$HERE" --fps 24 --workers ${WORKERS:-5} --out "$HERE/out/video.mp4"
"$PY" "$HERE/audio/mix.py"
"$PY" core/render/srt.py "$HERE/audio/cues.json" "$OUT/$NAME.srt"
node "$HERE/tools/subcheck.mjs" "$OUT/$NAME.srt"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$OUT/$NAME.mp4" 24 1
node core/render/still.mjs "$HERE" 39.9 --prefix poster_ --out "$HERE/stills"
cp "$HERE/stills/poster_39.9.jpg" "$OUT/poster.jpg"
mv "$HERE/stills/poster_39.9.jpg" "$HERE/stills/styleframe.jpg"
"$PY" "$HERE/tools/rhythm_report.py" "$OUT/$NAME.mp4"
"$PY" "$HERE/tools/final_asr.py" "$OUT/$NAME.mp4"
"$PY" "$HERE/tools/camplot.py"
echo "done: $OUT/$NAME.mp4"
