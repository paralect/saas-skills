# python voiceover.py <lines.json> <out.wav> <video length s> [voice] [speed]
# Narration with Kokoro TTS (local, offline): each line is spoken at its start time on the video's timeline.
# lines.json: [[start_seconds, "text"], ...] in time order. Fails (exit 1) if a line would run into the next one or
# past the end of the video, and prints every line's start-end and the gap after it, so you can re-time and rerun.
# Models: $KOKORO_DIR (default ~/.cache/kokoro) must hold kokoro-v1.0.onnx and voices-v1.0.bin (setup-kokoro.sh).
import json, os, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

lines_path, out_path, video_len = sys.argv[1], sys.argv[2], float(sys.argv[3])
voice = sys.argv[4] if len(sys.argv) > 4 else 'af_sky'
speed = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
model_dir = os.path.expanduser(os.environ.get('KOKORO_DIR', '~/.cache/kokoro'))
k = Kokoro(os.path.join(model_dir, 'kokoro-v1.0.onnx'), os.path.join(model_dir, 'voices-v1.0.bin'))

LINES = [tuple(x) for x in json.load(open(lines_path))]
SR = 24000
track = np.zeros(int((video_len + 1) * SR), dtype=np.float32)
bad = []
for i, (start, text) in enumerate(LINES):
    audio, sr = k.create(text, voice=voice, speed=speed, lang='en-us')
    assert sr == SR
    end = start + len(audio) / SR
    nxt = LINES[i + 1][0] if i + 1 < len(LINES) else video_len
    print(f'{start:5.1f}-{end:5.1f}s  gap to next {nxt - end:4.1f}s  {text}')
    if end > nxt - 0.15:
        bad.append(f'line {i + 1} ends at {end:.1f}s, needs to end by {nxt - 0.15:.1f}s')
    s = int(start * SR); track[s:s + len(audio)] += audio[: max(0, len(track) - s)]
if bad:
    sys.exit('overlaps, re-time or shorten:\n  ' + '\n  '.join(bad))
sf.write(out_path, track[: int(video_len * SR)], SR)
print(f'wrote {out_path}')
