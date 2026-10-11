#!/usr/bin/env bash
# Regenerates screenshots/limits-meter-demo.gif and .mp4: the README's opening GIF.
# limits-meter.demo.tsx drives the mod through `claude plugin test` and prints a frame per scene;
# demo.py paints each frame with Pillow and joins them with ffmpeg. Needs ffmpeg and Pillow.
set -euo pipefail
cd "$(dirname "$0")/../.."
out=$(mktemp -d)
trap 'rm -rf "$out"; rm -f limits-meter/tests/zz-demo.test.tsx' EXIT
cp scripts/screenshots/limits-meter.demo.tsx limits-meter/tests/zz-demo.test.tsx
claude plugin test ./limits-meter 2>&1 | grep -E '^FRAME ' > "$out/frames.txt"
"${PYTHON:-python3}" scripts/screenshots/demo.py "$out/frames.txt" screenshots limits-meter
