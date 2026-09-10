#!/bin/sh
set -e
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
export DISPLAY=:99

# Electron 4.x == Chromium 69 with Chrome-branded FFmpeg (H.264/AAC).
# Its DevTools endpoint binds loopback only, so forward it to the container IP.
socat TCP-LISTEN:9223,fork,reuseaddr TCP:127.0.0.1:9222 >/tmp/socat.log 2>&1 &

exec electron /app --no-sandbox --disable-gpu \
  --remote-debugging-address=0.0.0.0 --remote-debugging-port=9222
