#!/usr/bin/env bash
# Build and run the Chromium 69 (Electron 4.2.12, H.264-capable) browser used by
# the end-to-end test and the playground, via Apple's `container` CLI.
#
#   scripts/chrome69.sh up     # build + run, prints the CDP URL
#   scripts/chrome69.sh url    # print the CDP URL of the running browser
#   scripts/chrome69.sh down   # stop and remove it
#
# `up` writes the URL to .cdp-url, which test/e2e.mjs reads by default.
#
# Defaults to the host's native architecture (arm64 on Apple Silicon) so video
# decodes natively. Set ARCH=amd64 only to reproduce the Rosetta setup.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
NAME=itv-chrome69
IMAGE=invidious-tizen/chrome69:4
CTX="$HERE/test/browser69"
URLFILE="$HERE/.cdp-url"

case "$(uname -m)" in
  arm64|aarch64) HOSTARCH=arm64 ;;
  *) HOSTARCH=amd64 ;;
esac
ARCH="${ARCH:-$HOSTARCH}"
case "$ARCH" in
  arm64) EARCH=arm64; ROSETTA="" ;;
  amd64) EARCH=x64; ROSETTA="--rosetta" ;;
  *) echo "unsupported ARCH=$ARCH (use arm64 or amd64)" >&2; exit 2 ;;
esac
PLATFORM="linux/$ARCH"

if ! command -v container >/dev/null; then
  echo "Apple's 'container' CLI is required." >&2
  exit 2
fi

cdp_url() {
  local ip
  ip="$(container list 2>/dev/null | awk -v n="$NAME" '$1==n{print $6}' | cut -d/ -f1)"
  [ -n "$ip" ] && echo "http://$ip:9223"
}

case "${1:-up}" in
  up)
    container build --platform "$PLATFORM" --build-arg EARCH="$EARCH" -t "$IMAGE" -f "$CTX/Dockerfile" "$CTX" >/dev/null
    container stop "$NAME" >/dev/null 2>&1 || true
    container rm "$NAME" >/dev/null 2>&1 || true
    # shellcheck disable=SC2086
    container run -d --name "$NAME" --platform "$PLATFORM" $ROSETTA -m 3g "$IMAGE" >/dev/null
    for _ in $(seq 1 60); do
      url="$(cdp_url)"
      if [ -n "$url" ] && curl -fsS --max-time 2 "$url/json/version" >/dev/null 2>&1; then
        printf '%s' "$url" > "$URLFILE"
        echo "$url"
        exit 0
      fi
      sleep 1
    done
    echo "chrome69 did not become ready" >&2
    exit 1
    ;;
  down)
    container stop "$NAME" >/dev/null 2>&1 || true
    container rm "$NAME" >/dev/null 2>&1 || true
    rm -f "$URLFILE"
    echo "stopped"
    ;;
  url)
    if [ -f "$URLFILE" ]; then cat "$URLFILE"; else cdp_url; fi
    echo
    ;;
  *)
    echo "usage: $0 {up|down|url}" >&2
    exit 2
    ;;
esac
