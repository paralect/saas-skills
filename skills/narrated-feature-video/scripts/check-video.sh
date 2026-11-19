#!/usr/bin/env bash
# bash check-video.sh <video.mp4> [moves.json]: the review gate for a take. Prints
#   1. duration;
#   2. every sudden full-frame change (scene score > 0.08) with its time: each one must be something you meant
#      (a dialog opening, results appearing, a page change at a deliberate cut). Any other entry is an unwanted jump;
#   3. the take's marks on the video clock, from <video>.marks.json (written by Recorder.encode): time the voice from these;
#   4. with moves.json (written by the take from rec.mjs `moves`): cursor steps over 120 px (teleports; must be none.
#      Fast long moves take ~50 px steps, that is fine);
# and writes <video>-sheet.png (1 frame/s, 4 per row, left to right, top to bottom) plus a full-size frame just after
# every sudden change (<video>-at-<s>.png): open those to check the cursor is visible and nothing private shows.
set -euo pipefail
V="$1"; M="${2:-}"; B="${V%.*}"
echo "duration: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")s"
CH=$(ffmpeg -v info -i "$V" -vf "select='gt(scene,0.08)',showinfo" -f null - 2>&1 | grep -o 'pts_time:[0-9.]*' | cut -d: -f2 || true)
# changes less than 0.3 s apart are one event (a scroll or an animation shows as a burst): print them as a range
echo "sudden changes at (s): $(echo $CH | tr ' ' '\n' | awk 'NF{ if (n && $1-last<0.3) {last=$1; next} if (n) printf (last>first? "%.1f-%.1f " : "%.1f "), first, last; first=$1; last=$1; n=1 } END{ if (n) printf (last>first? "%.1f-%.1f" : "%.1f"), first, last }')"
echo "  (a range is a scroll or animation; every entry must be something you meant)"
rm -f "$B"-at-*.png
LAST=-9
for t in $CH; do
  # one full-size frame 0.4 s after each change (changes within 1 s of the previous one are skipped)
  if awk -v a="$t" -v b="$LAST" 'BEGIN{exit !(a-b>=1)}'; then
    ffmpeg -v error -y -ss "$(awk -v a="$t" 'BEGIN{print a+0.4}')" -i "$V" -frames:v 1 "$B-at-$(printf '%.1f' "$t").png"; LAST=$t
  fi
done
N=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V" | awk '{print int($1)+1}')
COLS=4; ROWS=$(( (N + COLS - 1) / COLS ))
ffmpeg -v error -y -i "$V" -vf "fps=1,scale=960:-1,tile=${COLS}x${ROWS}:color=white" -frames:v 1 "$B-sheet.png"
echo "sheet: $B-sheet.png (${COLS} per row, 1 frame per second); full-size frames: $(ls "$B"-at-*.png 2>/dev/null | wc -l | tr -d ' ') x $B-at-<s>.png"
if [ -f "$V.marks.json" ]; then
  python3 -c "
import json; d = json.load(open('$V.marks.json'))
print('marks (video time):'); [print(f\"  {m['video']:5.1f}s  {m['label']}\") for m in d['marks']]"
fi
if [ -n "$M" ]; then
python3 - "$M" <<'EOF'
import json, sys
m = json.load(open(sys.argv[1]))
jumps = [(a[0]-m[0][0], ((b[1]-a[1])**2+(b[2]-a[2])**2)**.5) for a, b in zip(m, m[1:]) if ((b[1]-a[1])**2+(b[2]-a[2])**2)**.5 > 120]
print('cursor jumps > 120px (teleports):', 'none' if not jumps else ', '.join(f'{t:.1f}s ({d:.0f}px)' for t, d in jumps))
EOF
fi
