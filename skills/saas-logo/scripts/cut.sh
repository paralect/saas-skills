#!/usr/bin/env bash
# Runs cut.py with Pillow and NumPy available: the system Python when it has
# them, otherwise a small venv of its own in this folder, made once.
#   cut.sh render.png out/ --name relay
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
if python3 -c "import PIL, numpy" 2>/dev/null; then
  exec python3 "$here/cut.py" "$@"
fi
venv="$here/.venv"
if [ ! -x "$venv/bin/python" ]; then
  python3 -m venv "$venv"
  "$venv/bin/pip" install --quiet --disable-pip-version-check pillow numpy
fi
exec "$venv/bin/python" "$here/cut.py" "$@"
