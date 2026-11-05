#!/usr/bin/env bash
# Row generated tiles (or reference marks) up on the light canvas, to judge
# them side by side. PNG, JPEG and WebP all work, whatever the extension says.
#   sheet.sh out/sheet.png bars.png hash.png leaf.png
# Needs rsvg-convert (brew install librsvg).
set -euo pipefail
out="$1"; shift
tile=400; gap=40; pad=40; cols=6
n=$#; rows=$(( (n + cols - 1) / cols )); c=$(( n < cols ? n : cols ))
w=$(( pad*2 + c*tile + (c-1)*gap )); h=$(( pad*2 + rows*tile + (rows-1)*gap ))
svg="$(mktemp -t sheet).svg"
{
  echo "<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 $w $h'><rect width='$w' height='$h' fill='#f3f3f1'/>"
  i=0
  for f in "$@"; do
    # Embedded as a data URI with the real type, so the file's name doesn't matter.
    mime="$(file --brief --mime-type "$f")"
    x=$(( pad + (i % cols) * (tile + gap) )); y=$(( pad + (i / cols) * (tile + gap) ))
    printf "<image x='%s' y='%s' width='%s' height='%s' preserveAspectRatio='xMidYMid meet' xlink:href='data:%s;base64,%s'/>\n" \
      "$x" "$y" "$tile" "$tile" "$mime" "$(base64 < "$f" | tr -d '\n')"
    i=$(( i + 1 ))
  done
  echo "</svg>"
} > "$svg"
rsvg-convert -w "$w" "$svg" -o "$out"; rm -f "$svg"
echo "$out ($# tiles)"
