FROM node:20-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Install native dependencies required by sharp, node-gyp, and chrome
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    gnupg \
    ca-certificates \
    python3 \
    make \
    g++ \
    libvips-dev \
    fonts-liberation \
    libasound2 \
    libgbm1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxss1 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome for WhatsApp integration
RUN mkdir -p /etc/apt/keyrings \
    && wget -q -O- https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Create uploads and PDF cache directories
RUN mkdir -p /app/uploads /app/storage

# CLUSTER_WORKERS=2 uses both cores; set to 1 to disable cluster mode
ENV CLUSTER_WORKERS=2

EXPOSE 3000

CMD ["node", "cluster.js"]
