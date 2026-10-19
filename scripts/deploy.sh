#!/usr/bin/env bash
# Build the app and copy it to the NAS. Nothing is guessed: you must say where, and the
# script refuses anything that looks like it could be the wrong folder, because the copy
# DELETES everything in the destination that is not part of the build.
#
#   First time, into a new folder used only for Cairn:
#     CAIRN_INIT=1 NAS_TARGET=user@nas:/volume1/docker/cairn/site npm run deploy
#   After that:
#     NAS_TARGET=user@nas:/volume1/docker/cairn/site npm run deploy
#
# NAS_TARGET is any rsync destination: user@host:/absolute/path, or a local folder.
# CAIRN_YES=1 skips the "apply these changes?" question (for scripts).
set -euo pipefail

fail() {
  echo "deploy: $*" >&2
  exit 1
}

[ -n "${NAS_TARGET:-}" ] || fail "set NAS_TARGET, for example NAS_TARGET=user@nas:/volume1/docker/cairn/site"
target="${NAS_TARGET%/}"

# The folder part: after "host:" for a remote target, otherwise the whole value.
if [[ "$target" == *:* ]]; then path="${target#*:}"; else path="$target"; fi

case "$path" in
  "" | "/" | "." | ".." | "~" | "~/"* | "/~"*) fail "refusing '$NAS_TARGET': that is a root or home folder, not a place for the app" ;;
esac
[[ "$path" == /* ]] || fail "use an absolute folder path (starting with /), not '$path'"
[[ "$path" != *".."* ]] || fail "refusing a path containing '..'"
depth=$(printf '%s' "$path" | tr '/' '\n' | grep -c . || true)
[ "$depth" -ge 3 ] || fail "'$path' is too shallow (use a dedicated folder like /volume1/docker/cairn/site)"

# The destination must already be a Cairn site (it holds a marker file), unless this is the
# first deploy into a new folder, which has to be asked for explicitly.
if ! rsync --list-only "$target/.cairn-site" >/dev/null 2>&1; then
  [ "${CAIRN_INIT:-}" = "1" ] ||
    fail "'$target' has no .cairn-site marker, so it isn't known to be a Cairn folder. If it is a NEW folder used only for Cairn, run once with CAIRN_INIT=1."
fi

cd "$(dirname "$0")/.."
npm run build
touch dist/.cairn-site

echo "Changes to be made in $target (nothing has changed yet):"
rsync -avn --delete-after --max-delete=200 dist/ "$target/"

if [ "${CAIRN_YES:-}" != "1" ]; then
  read -r -p "Apply these changes? [y/N] " answer
  [[ "$answer" == [yY]* ]] || fail "cancelled, nothing was changed"
fi

# --max-delete stops a mistaken target with lots of other files from being emptied.
rsync -av --delete-after --max-delete=200 dist/ "$target/"
echo "Deployed. Installed phones pick up the new version the next time they open the app online."
