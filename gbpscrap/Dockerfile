FROM node:22-bookworm-slim

WORKDIR /app

# Install system dependencies required for Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci || npm install

# Install Playwright Chromium and required OS dependencies
RUN npx playwright install --with-deps chromium

# Copy application files
COPY gbpscrap ./gbpscrap
COPY tsconfig*.json ./

# Compile TypeScript into gbpscrap/dist
RUN npx tsc -p gbpscrap/tsconfig.json

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV HEADLESS=true

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=10s \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "gbpscrap/dist/index.js"]
