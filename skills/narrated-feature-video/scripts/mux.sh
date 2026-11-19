#!/usr/bin/env bash
# bash mux.sh <silent.mp4> <voice.wav> <out.mp4>: adds the narration to the screen recording, video untouched,
# speech levelled to -18 LUFS, AAC 160k 48 kHz, faststart for the web.
set -euo pipefail
ffmpeg -v error -y -i "$1" -i "$2" -map 0:v -map 1:a -c:v copy \
  -af loudnorm=I=-18:TP=-1.5:LRA=11 -c:a aac -b:a 160k -ar 48000 -shortest -movflags +faststart "$3"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$3" | xargs printf 'wrote %s (%ss)\n' "$3"
