# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install all deps (including devDependencies for tsc)
COPY package*.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Sevalla injects PORT automatically; this is just documentation
EXPOSE 5001

CMD ["node", "dist/index.js"]
