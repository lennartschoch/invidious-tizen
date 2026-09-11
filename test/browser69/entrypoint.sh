#!/bin/sh
set -e
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
export DISPLAY=:99

# Xvfb has no window manager, so a Fullscreen API request (the player's OK
# action) never completes and the renderer hangs. Matchbox services fullscreen
# and draws no decorations, so the 1920x1080 window fills the screen.
matchbox-window-manager -use_titlebar no >/tmp/wm.log 2>&1 &

# Electron 4.x == Chromium 69 with Chrome-branded FFmpeg (H.264/AAC).
# Its DevTools endpoint binds loopback only, so forward it to the container IP.
socat TCP-LISTEN:9223,fork,reuseaddr TCP:127.0.0.1:9222 >/tmp/socat.log 2>&1 &

# /dev/shm is only 64M here, which crashes the renderer during video decode, so
# let Chromium back its shared memory with /tmp instead. (No sound card; the
# ALSA errors are harmless and Chromium falls back to a paced null sink.)
exec electron /app --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --remote-debugging-address=0.0.0.0 --remote-debugging-port=9222
