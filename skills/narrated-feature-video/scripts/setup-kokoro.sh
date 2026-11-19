#!/usr/bin/env bash
# bash setup-kokoro.sh: one-time setup of the local Kokoro TTS used by voiceover.py.
# Creates a venv at ~/.cache/kokoro/.venv (python 3.10-3.12) and downloads the v1.0 model files (~350 MB) there.
# Re-running is safe: it skips what is already in place. Prints the python to use.
set -euo pipefail
DIR="${KOKORO_DIR:-$HOME/.cache/kokoro}"
mkdir -p "$DIR"
cd "$DIR"
if ! .venv/bin/python -c "import kokoro_onnx, soundfile" 2>/dev/null; then
  rm -rf .venv
  PY=$(command -v python3.12 || command -v python3.11 || command -v python3.10 || command -v python3)
  "$PY" -m venv .venv
  .venv/bin/pip install -q --upgrade pip
  .venv/bin/pip install -q kokoro-onnx soundfile numpy
fi
BASE=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  [ -s "$f" ] || curl -fL --retry 3 -o "$f" "$BASE/$f"
done
echo "python: $DIR/.venv/bin/python"
