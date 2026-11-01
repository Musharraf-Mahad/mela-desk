FROM node:22-bookworm-slim

WORKDIR /app

# Prisma requires OpenSSL
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# Copy backend source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

EXPOSE 5000

# Apply migrations before starting the API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]