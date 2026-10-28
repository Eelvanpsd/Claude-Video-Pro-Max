#!/bin/sh
# Rebuild every object in kit/objects/ from its source photo, exactly as used in the film.
# Sources (licences in demo/CREDITS and sources/candidates/candidates.json) are downloaded into sources/candidates/
# by kit/tools/fetch_sources.py; BiRefNet masks are cached in sources/masks/.
# The tools run in a private venv (demo/.venv: numpy, scipy, Pillow, onnxruntime) with the BiRefNet-general ONNX
# model; kit/tools/kit_env.sh makes both when missing. About 3 minutes after the downloads.
# Everything is cut at the photo's own resolution (tools/rescheck.mjs proves no frame upsamples a photo).
set -e
KIT=$(cd "$(dirname "$0")/.." && pwd); DEMO=$(dirname "$KIT")
LIB=${LIB:-$(cd "$DEMO/../../.." && pwd)}
cd "$DEMO"
python3 kit/tools/fetch_sources.py
. kit/tools/kit_env.sh
PY="$KPY"
T="kit/tools"; SRC="sources/candidates"; M="sources/masks"; D="sources/derived"   # relative: the metas record portable paths
mkdir -p "$M" "$D"

# ship, seen from straight above (CC BY 4.0, BAW): rotated so the bow points down, hull polygon keeps its shadow out
"$PY" "$T/prep_object.py" "$SRC/ship_top/ship_top_1.jpg" ship --rotate 90 --crop 740,190,1230,2820 \
  --poly "34,14 464,14 464,2490 430,2560 340,2606 240,2614 140,2606 52,2560 34,2490" --keep-largest --sat .95 --max 2700 \
  --anchor bow=0.5,1.0 --anchor stern=0.5,0.0

# ship, side view (CC0): container logos, the hull name and hull markings wiped by a median filter, then cut out
"$PY" "$T/clean_lettering.py" "$SRC/ship_side/ship_side_1.jpg" "$D/ship_side_clean.png" --rect 700,930,3130,1375,15 \
  --rect 520,1300,760,1380,45 --rect 300,1390,3700,1500,31 --rect 3320,940,3450,1000,15 --rect 3250,700,3500,840,15
"$PY" "$T/prep_object.py" "$D/ship_side_clean.png" ship_side --crop 250,700,3710,1530 --keep-largest --erode 1 --sat .9 --max 3500
"$PY" "$T/ship_anchors.py" ship_side --bow left

# beam (PD-self): three-span haunched concrete girder; L/R = the two river piers of the main span
"$PY" "$T/prep_object.py" "$SRC/beam/beam_3.jpg" beam --crop 100,770,2790,1022 --keep-largest --erode 1 --sat .45 --warm -.02 --max 2700 \
  --anchor-px L=895,242 --anchor-px R=1805,242

# arch (PD-Highsmith): steel through-arch; the road sign removed; hangers lost against the hills continued to the deck
"$PY" "$T/prep_object.py" "$SRC/arch/arch_1.tif" arch --crop 0,1470,7000,3440 --poly "0,0 7000,0 7000,560 6850,600 6800,1970 0,1970" \
  --cut 2300,880,2530,1030 --keep-largest --erode 1 --sat .8 --max 7000 --anchor-px L=1096,1944 --anchor-px R=6337,1965
"$PY" "$T/repair_hangers.py" arch --deck 0.574 --band 0.04 --x0 0.25 --x1 0.9 --minfill 0
"$PY" "$T/repair_hangers.py" arch --deck 0.574 --band 0.05 --x0 0.18 --x1 0.9

# cable-stayed (PD-Highsmith): pylon + deck cut without the stays (sky region masked out), the stays measured from a
# light top-hat key and redrawn as clean lines; one pylon and its fan, cut at mid-span, mirrored into a two-pylon main span
"$PY" "$T/sky_key.py" "$SRC/cable/cable_1.tif" "$M/cable_sky.png" --crop 82,600,6900,3480 \
  --above "0,2060 4500,2110 4560,2000 4800,2000 4800,2180 6818,2230" --exclude "4590,50 4790,50 4930,2240 4420,2240" --light --size 15 --lo 6 --hi 26
"$PY" -c "from PIL import Image, ImageOps; ImageOps.invert(Image.open('$M/cable_sky_region.png').convert('L')).save('$M/cable_nosky.png')"
"$PY" "$T/prep_object.py" "$SRC/cable/cable_1.tif" cable_half --crop 82,600,6900,3480 --mask-mul "$M/cable_nosky.png" \
  --patch 4820,2380,4915,2820,-190,0 --cut 4560,2060,4760,2112 --min-island 0.0003 --erode 0 --sat .55 --max 7000 --anchor-px P=4681,2875
"$PY" "$T/redraw_stays.py" cable_half --key "$M/cable_sky.png" --pylon 4681 --deck-y 2174 --scan-deck 1800 --scan-left 4450 --scan-right 4900 \
  --width 7 --keep-poly "4600,40 4780,40 4900,2240 4450,2240"
"$PY" "$T/mirror_span.py" cable_half cable --pylon 0.68656 --water 0.995 --max 9000

# suspension (CC BY 2.0, Russ): towers and deck from BiRefNet + a dark top-hat key; the main span (between the towers'
# inner faces) stretched ×1.7 so the towers keep their shape at a two-kilometre span; main cables and hangers redrawn clean
"$PY" "$T/sky_key.py" "$SRC/suspension/suspension_1.jpg" "$M/susp_sky.png" --crop 380,1420,5372,2620 \
  --above "0,330 330,470 360,720 2000,740 4560,800 4800,640 4992,600"
"$PY" "$T/prep_object.py" "$SRC/suspension/suspension_1.jpg" susp_raw --crop 380,1420,5372,2620 --mask-max "$M/susp_sky.png" \
  --min-island 0.0005 --erode 0 --sat .35 --max 5000 --anchor L=0.176,0.962 --anchor R=0.935,0.962
"$PY" "$T/stretch_span.py" susp_raw suspension --from 0.19 --to 0.918 --k 1.7 --max 8000
"$PY" "$T/redraw_suspension.py" suspension

# photo prints pinned on the wall (four of the same photographs, uncut, on photo paper; the ship from the cleaned side view)
"$PY" "$T/make_print.py" "$SRC/suspension/suspension_1.jpg" print_susp --crop 0,1150,5372,3450
"$PY" "$T/make_print.py" "$SRC/cable/cable_1.tif" print_cable --crop 0,400,7360,4300
"$PY" "$T/make_print.py" "$SRC/arch/arch_1.tif" print_arch --crop 0,1000,7360,4300
"$PY" "$T/make_print.py" "$D/ship_side_clean.png" print_ship --crop 120,480,3830,1780 --w 1000   # the side-view ship, lettering wiped
echo "objects rebuilt in $KIT/objects"
