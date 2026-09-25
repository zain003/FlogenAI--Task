# Multi-stage Dockerfile for NestJS Backend
# Stage 1: Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install native compilation dependencies for packages like bcrypt
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production Runtime Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install curl for container healthchecks and python3/make/g++ for building native prod modules
RUN apk add --no-cache curl python3 make g++

COPY package*.json ./
RUN npm install --omit=dev && \
    apk del python3 make g++

COPY --from=builder /app/dist ./dist

# Use non-root node user for container security
USER node

EXPOSE 3001

CMD ["node", "dist/main"]
