FROM debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip xvfb xauth socat \
    libgtk-3-0 libnss3 libnspr4 libasound2 libgbm1 libxshmfence1 \
    libxdamage1 libxcomposite1 libxrandr2 libxfixes3 libxrender1 \
    libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libcups2 libdbus-1-3 \
    libpango-1.0-0 libcairo2 libdrm2 libxkbcommon0 libxss1 libxtst6 \
    libx11-xcb1 libxcb-dri3-0 libglib2.0-0 libuuid1 fonts-liberation \
 && rm -rf /var/lib/apt/lists/*

# Electron 4.x == Chromium 69.0.3497.106, and official Electron builds ship
# Chrome-branded FFmpeg (H.264/AAC), unlike the open-source Chromium snapshots.
ARG EV=4.2.12
RUN curl -fsSL "https://github.com/electron/electron/releases/download/v${EV}/electron-v${EV}-linux-x64.zip" -o /tmp/e.zip \
 && unzip -q /tmp/e.zip -d /opt/electron \
 && rm /tmp/e.zip \
 && ln -s /opt/electron/electron /usr/local/bin/electron

COPY package.json /app/package.json
COPY main.js /app/main.js
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
WORKDIR /app
EXPOSE 9222

ENTRYPOINT ["/entrypoint.sh"]
