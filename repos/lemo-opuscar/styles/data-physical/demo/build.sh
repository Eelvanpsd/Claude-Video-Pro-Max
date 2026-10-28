#!/bin/sh
# One command: 《两条螺旋》Two Spirals (Data Physicalization demo)
#   sh demo/build.sh     packs + fonts (when missing) → voice → speech check → events → picture → score + mix → master → .srt → checks → poster
set -e
HERE=$(cd "$(dirname "$0")" && pwd)                 # .../<slug>/demo
FILM=$(cd "$HERE/.." && pwd)                         # .../<slug>
LIB=${LIB:-$(cd "$HERE/../../.." && pwd)}            # films/<slug>/demo or styles/<slug>/demo -> library root
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the library folder"; exit 1; }
PY="$LIB/.venv/bin/python"
NAME=data-physical
cd "$LIB"

# packs that are not in git (each fetched only when missing)
[ -f core/assets/polyhaven/photo_studio_loft_hall_2k.hdr ] || sh tools/fetch.sh hdri      # Poly Haven studio HDRI (CC0, 12 MB)
[ -f core/tts/kokoro-v1.0.onnx ] || sh tools/fetch.sh voice                               # Kokoro model (setup.sh deps voice installs the Python side)
for l in vsco2ce vcsl freepats; do [ -d "core/audio/instruments/$l" ] || sh tools/fetch.sh instruments $l; done   # CC0 samples for the score
# fonts: the .woff2 subsets are gitignored; fetch them (Google Fonts, OFL) whenever one that fonts.css names is missing
NEED_FONTS=0
[ -f "$HERE/fonts.css" ] || NEED_FONTS=1
for f in $(grep -o 'fonts/[^)]*\.woff2' "$HERE/fonts.css" 2>/dev/null); do [ -f "$HERE/$f" ] || NEED_FONTS=1; done
if [ "$NEED_FONTS" = 1 ]; then node "$HERE/tools/fonts.mjs" "$HERE"; fi

# voice: Kokoro (af_heart), then a speech-to-text check with the small English model
node "$HERE/tools/export.mjs" "$HERE" > /dev/null || true
"$PY" core/tts/tts.py "$HERE/voice/lines.json" "$HERE/voice/out"
WHISPER_MODEL=small.en "$PY" core/tts/asr_check.py "$HERE/voice/lines.json" "$HERE/voice/out" --lang en
node "$HERE/tools/export.mjs" "$HERE"                # out/cues.json from the real durations; fails on overlap

# picture, events, score + mix, master
node core/render/events.mjs "$HERE"
node core/render/video.mjs "$HERE" --fps 24 --workers 3 --out "$HERE/out/video.mp4"
"$PY" "$HERE/mix.py"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$FILM/$NAME.mp4" 24 1
node "$HERE/tools/srt.mjs" "$HERE" > "$HERE/out/cues_srt.json"
"$PY" core/render/srt.py "$HERE/out/cues_srt.json" "$FILM/$NAME.srt"

# checks
node "$HERE/tools/subcheck.mjs" "$HERE"
node core/render/readcheck.mjs "$HERE" > "$HERE/out/readcheck.txt" && echo "readcheck ok" || { cat "$HERE/out/readcheck.txt" | grep -v "^OK" ; exit 1; }
"$PY" -I "$HERE/tools/holdcheck.py" "$HERE"

# poster (the dial with the brass puck) and the gallery style frame
ffmpeg -v error -y -ss 37.8 -i "$FILM/$NAME.mp4" -frames:v 1 -q:v 2 "$FILM/poster.jpg"
mkdir -p "$HERE/stills"
ffmpeg -v error -y -ss 28.6 -i "$FILM/$NAME.mp4" -frames:v 1 -q:v 2 "$HERE/stills/styleframe.jpg"
echo "done: $FILM/$NAME.mp4"
