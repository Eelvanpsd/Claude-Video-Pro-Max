#!/bin/sh
# The cut-out tools' own environment, kept out of the library's .venv:
#   demo/.venv      a private venv with numpy, scipy, Pillow and onnxruntime (made with uv when present)
#   the matting model BiRefNet-general ONNX (MIT, about 970 MB), found at $BIREFNET_ONNX, demo/.models/,
#   or ~/.rembg/models/birefnet-general/ (an existing rembg cache), else downloaded into demo/.models/.
# Source it from the demo folder (DEMO=<demo> . kit/tools/kit_env.sh) to get $KPY and $BIREFNET_ONNX; idempotent.
# Without the model, prep_object.py still cuts with --poly (a hand polygon) or --mask (a mask image).
KIT_DEMO=${DEMO:-$(pwd)}
LIB=${LIB:-$(cd "$KIT_DEMO/../../.." && pwd)}
KPY="$KIT_DEMO/.venv/bin/python"
if ! "$KPY" -c "import numpy, scipy, PIL, onnxruntime" 2>/dev/null; then
  echo "kit_env: making the private venv $KIT_DEMO/.venv (numpy scipy pillow onnxruntime)"
  BASEPY="$LIB/.venv/bin/python"; [ -x "$BASEPY" ] || BASEPY=python3
  if command -v uv >/dev/null 2>&1; then
    uv venv --quiet --python "$BASEPY" "$KIT_DEMO/.venv" && uv pip install --quiet --python "$KPY" numpy scipy pillow onnxruntime
  else
    "$BASEPY" -m venv "$KIT_DEMO/.venv" && "$KPY" -m pip install --quiet --disable-pip-version-check numpy scipy pillow onnxruntime
  fi
fi
MODEL_URL=https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-epoch_244.onnx
if [ -z "$BIREFNET_ONNX" ] || [ ! -f "$BIREFNET_ONNX" ]; then
  for m in "$KIT_DEMO/.models/birefnet-general.onnx" "$HOME/.rembg/models/birefnet-general/birefnet-general.onnx"; do
    [ -f "$m" ] && { BIREFNET_ONNX=$m; break; }
  done
fi
if [ -z "$BIREFNET_ONNX" ] || [ ! -f "$BIREFNET_ONNX" ]; then
  BIREFNET_ONNX="$KIT_DEMO/.models/birefnet-general.onnx"; mkdir -p "$KIT_DEMO/.models"
  echo "kit_env: downloading the matting model (about 970 MB) → $BIREFNET_ONNX"
  curl -fL --retry 3 -o "$BIREFNET_ONNX.part" "$MODEL_URL" && mv "$BIREFNET_ONNX.part" "$BIREFNET_ONNX"
fi
export KPY BIREFNET_ONNX
