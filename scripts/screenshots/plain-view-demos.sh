#!/usr/bin/env bash
# Regenerates screenshots/plain-view-*.gif and .mp4: the card across four scenarios.
# plain-view.demo.tsx drives the mod through `claude plugin test` and prints a frame per state;
# demo.py paints each frame with Pillow and joins them with ffmpeg. Needs ffmpeg and Pillow.
set -euo pipefail
cd "$(dirname "$0")/../.."
out=$(mktemp -d)
trap 'rm -rf "$out"; rm -f plain-view/tests/zz-demo.test.tsx' EXIT
cp scripts/screenshots/plain-view.demo.tsx plain-view/tests/zz-demo.test.tsx
claude plugin test ./plain-view 2>&1 | grep -E '^FRAME ' > "$out/frames.txt"
"${PYTHON:-python3}" scripts/screenshots/demo.py "$out/frames.txt" screenshots
