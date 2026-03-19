FROM node:20-slim

# Install system deps for audio transcription fallback
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg curl && \
    pip3 install --break-system-packages yt-dlp && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node.js deps
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Copy source and build
COPY . .
RUN npm run build

# Expose port
ENV NODE_ENV=production
EXPOSE ${PORT:-5000}

CMD ["node", "dist/index.cjs"]
