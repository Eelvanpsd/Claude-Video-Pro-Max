#!/bin/sh
# 从开源仓库 foostan/crkbd（固定提交 63366fb）重新生成 data/pcb.json 与 data/case.bin。
# 需要：网络、python3、node、npm（临时安装 occt-import-js@0.0.23 到 $TMP）
set -e
HERE=$(cd "$(dirname "$0")/.." && pwd)
TMP=${TMP_DIR:-$(mktemp -d)}
REV=63366fb7f51cf2a796462fdd90527e99dd126055
B=https://raw.githubusercontent.com/foostan/crkbd/$REV
mkdir -p "$TMP/dl" "$TMP/occt"
for f in pcbs/corne-cherry/hotswap/corne-cherry.kicad_pcb plates/3x6/pcb/plate-top-cherrymx.kicad_pcb cases/3x6/left.step; do
  curl -sfL -o "$TMP/dl/$(basename "$f")" "$B/$f"
done
python3 -I "$HERE/tools/extract_pcb.py" "$TMP/dl/corne-cherry.kicad_pcb" "$TMP/dl/plate-top-cherrymx.kicad_pcb" "$HERE/data/pcb.json"
(cd "$TMP/occt" && npm init -y >/dev/null && npm i --silent occt-import-js@0.0.23)
OCCT_DIR="$TMP/occt" node "$HERE/tools/step2mesh.mjs" "$TMP/dl/left.step" "$HERE/data/case.bin"
echo "data regenerated from crkbd@$REV"
