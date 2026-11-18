#!/usr/bin/env bash
# Build the tree Gandi actually runs.
#
# The host app root is /lamp0/web/vhosts/default and its package.json
# starts `node src/server.js`. server.js serves the web app from
# `__dirname/build`. Locally those pieces live in different places:
#   server/package.json + server/src/*   → app root and src/
#   build/                               → src/build
#
# Usage:
#   scripts/publish-gandi.sh            # rebuild the web app, then assemble
#   scripts/publish-gandi.sh --no-build # assemble from the current build/
#   scripts/publish-gandi.sh --push     # assemble, push master, then deploy default.git
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/.gandi-publish"
GANDI_SSH="c8f678fe-46da-11f1-9ef6-00163e94b645@git.sd3.gpaas.net"
DO_BUILD=1
DO_PUSH=0

for arg in "$@"; do
  case "$arg" in
    --no-build) DO_BUILD=0 ;;
    --push) DO_PUSH=1 ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: scripts/publish-gandi.sh [--no-build] [--push]" >&2
      exit 2
      ;;
  esac
done

cd "$ROOT"

if [[ "$DO_BUILD" -eq 1 ]]; then
  npm run build
fi

if [[ ! -f "$ROOT/build/index.html" ]]; then
  echo "Missing build/index.html. Run npm run build first." >&2
  exit 1
fi

mkdir -p "$DEST"
# Keep .git so a later --push stays a normal update of master.
shopt -s dotglob nullglob
for item in "$DEST"/*; do
  [[ "$(basename "$item")" == ".git" ]] && continue
  rm -rf "$item"
done
shopt -u dotglob nullglob

mkdir -p "$DEST/src"

cp "$ROOT/server/package.json" "$ROOT/server/package-lock.json" "$DEST/"
cp "$ROOT/server/src/server.js" "$DEST/src/server.js"

if [[ -f "$ROOT/server/src/eng.traineddata" ]]; then
  cp "$ROOT/server/src/eng.traineddata" "$DEST/src/eng.traineddata"
fi

rsync -a --delete \
  --exclude '__tests__/' \
  --exclude '*.test.js' \
  "$ROOT/server/src/server/" "$DEST/src/server/"

rsync -a --delete \
  "$ROOT/server/src/shared/" "$DEST/src/shared/"

rsync -a --delete \
  --exclude 'env.local.js' \
  "$ROOT/server/src/constants/" "$DEST/src/constants/"

rsync -a --delete \
  "$ROOT/build/" "$DEST/src/build/"

cat > "$DEST/.gitignore" <<'EOF'
node_modules/
src/uploads/
src/constants/env.local.js
.env
.env.*
EOF

echo "Gandi app root assembled at .gandi-publish"
echo
echo "package.json  →  node src/server.js"
echo "src/server.js"
echo "src/server/"
echo "src/shared/"
echo "src/constants/   (env.local.js stays on the server)"
echo "src/build/       (web app)"
echo
find "$DEST" -maxdepth 2 \( -type d -o -name 'server.js' -o -name 'package.json' -o -name 'index.html' \) \
  ! -path "$DEST/.git" ! -path "$DEST/.git/*" | sed "s|$DEST|.|" | sort

if [[ "$DO_PUSH" -eq 0 ]]; then
  echo
  echo "Not pushed. Run scripts/publish-gandi.sh --push to send this tree, then deploy default.git."
  exit 0
fi

REMOTE="$(git -C "$ROOT" remote get-url gandi)"
NAME="$(git -C "$ROOT" log -1 --format='%an')"
EMAIL="$(git -C "$ROOT" log -1 --format='%ae')"

if [[ ! -d "$DEST/.git" ]]; then
  git -C "$DEST" init -b master
fi

git -C "$DEST" add -A
if git -C "$DEST" diff --cached --quiet; then
  echo "Nothing new to publish."
else
  git -C "$DEST" -c user.name="$NAME" -c user.email="$EMAIL" commit -m "Publish the server and web build for Gandi."
fi

git -C "$DEST" remote remove gandi 2>/dev/null || true
git -C "$DEST" remote add gandi "$REMOTE"
git -C "$DEST" push -u gandi master

echo "Deploying default.git on Gandi..."
ssh -o BatchMode=yes "$GANDI_SSH" 'deploy default.git'
