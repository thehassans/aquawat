FROM node:20-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium

# Install native dependencies required by sharp, node-gyp, and chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    ca-certificates \
    python3 \
    make \
    g++ \
    libvips-dev \
    chromium \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production --no-audit --no-fund

COPY . .

# Create uploads and PDF cache directories
RUN mkdir -p /app/uploads /app/storage

# CLUSTER_WORKERS=2 uses both cores; set to 1 to disable cluster mode
ENV CLUSTER_WORKERS=2

EXPOSE 3000

CMD ["node", "cluster.js"]
