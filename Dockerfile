# ==========================
# Builder
# ==========================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# ==========================
# Realse
# ==========================
FROM node:22-alpine

ENV NODE_ENV=dev

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

CMD npm run start:dev