FROM node:20-slim

# Install system deps: python3, ffmpeg, yt-dlp for media processing
# build-essential + python3 needed for better-sqlite3 native compilation
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg curl build-essential && \
    pip3 install --break-system-packages yt-dlp && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node.js deps (including native modules like better-sqlite3)
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Copy source and build
COPY . .
RUN npm run build

# Create data directory for SQLite database
# On Railway, use a Volume mount at /data for persistence across deploys
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATA_DIR=/data
EXPOSE ${PORT:-5000}

CMD ["node", "dist/index.cjs"]
