#!/bin/bash
# 뱃일 — 파이어베이스를 앱 파일(www/firebase/*.js)로 묶는 법 (5.14 — 12.19.0)
#   ★ 앱은 이 다섯 파일과 chunk 하나를 ./firebase/ 에서 불러온다. 판을 바꾸면 chunk 이름이 바뀐다 →
#     sw.js 의 ASSETS 목록도 같이 고친다.
#   사용: bash tests/fb_bundle.sh 12.19.0 <나올 폴더>
set -e
VER="${1:-12.19.0}"; OUT="${2:-fb-out}"
W=$(mktemp -d); cd "$W"
npm init -y >/dev/null
npm install --silent "firebase@$VER" esbuild
mkdir src
for m in app auth firestore storage functions; do echo "export * from 'firebase/$m';" > "src/$m.js"; done
npx esbuild src/app.js src/auth.js src/firestore.js src/storage.js src/functions.js \
  --bundle --splitting --format=esm --minify --target=es2020 --platform=browser --legal-comments=none --outdir=out
cd - >/dev/null; mkdir -p "$OUT"; cp "$W"/out/*.js "$OUT"/
ls -la "$OUT"
echo "★ sw.js 의 chunk 이름을 이것으로: $(ls "$OUT" | grep chunk-)"
