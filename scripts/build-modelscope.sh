#!/usr/bin/env bash
# Builds the ModelScope Studio bundle (Gradio/Python SDK) into dist-modelscope/:
# the Next.js standalone server + static assets + app.py launcher.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=dist-modelscope
npx next build
mkdir -p "$OUT"
# Replace previous bundle contents (keep the folder, which may be a git clone).
find "$OUT" -mindepth 1 -maxdepth 1 ! -name .git ! -name .gitattributes ! -name README.md -exec rm -rf {} +
cp -R .next/standalone/. "$OUT/"
mkdir -p "$OUT/.next" && cp -R .next/static "$OUT/.next/static"
cp -R public "$OUT/public"
cp deploy/modelscope/app.py deploy/modelscope/requirements.txt "$OUT/"
# Image processing (sharp) is unused — images are unoptimized — and is ~47 MB.
rm -rf "$OUT/node_modules/@img" "$OUT/node_modules/sharp"
# Never ship local secrets or caches.
rm -f "$OUT/.env" "$OUT"/.env*.local "$OUT/data/cache.json"
du -sh "$OUT"
