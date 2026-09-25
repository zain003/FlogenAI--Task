# 000-infra-contracts.md — Infrastructure & Deployment Contracts

This file defines environment variables, database indexing & seed conventions, and Docker container topology for local development and multi-instance demonstration.

---

## 1. Environment Variables Contract

| Variable Name | Layer | Purpose | Build / Runtime | Required |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Both | Node environment (`development` / `test` / `production`) | Runtime | Yes |
| `PORT` | Backend | HTTP listening port (`3001` for Node 1, `3002` for Node 2) | Runtime | Yes |
| `MONGODB_URI` | Backend | MongoDB connection string (e.g. `mongodb://mongo:27017/marketplace`) | Runtime | Yes |
| `REDIS_HOST` | Backend | Redis hostname (e.g. `redis` or `localhost`) | Runtime | Yes |
| `REDIS_PORT` | Backend | Redis port (`6379`) | Runtime | Yes |
| `JWT_SECRET` | Backend | Cryptographic secret for signing auth tokens (min 32 chars) | Runtime | Yes |
| `JWT_EXPIRATION` | Backend | Token lifetime (e.g. `1d`, `3600s`) | Runtime | Yes |
| `STRIPE_SECRET_KEY` | Backend | Stripe Test Secret Key (`sk_test_...`) | Runtime | Yes |
| `STRIPE_WEBHOOK_SECRET` | Backend | Secret for verifying Stripe webhook signatures (`whsec_...`) | Runtime | Yes |
| `NEXT_PUBLIC_API_URL` | Frontend | Base URL for REST requests (e.g. `http://localhost:8080/api`) | Build & Runtime | Yes |
| `NEXT_PUBLIC_SOCKET_URL` | Frontend | Base URL for Socket.IO connection (e.g. `http://localhost:8080`) | Build & Runtime | Yes |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Frontend | Stripe Test Publishable Key (`pk_test_...`) | Build & Runtime | Yes |

---

## 2. Docker Compose Topology

The development and scaling demo environment runs 6 containers orchestrated via `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mongo:
    image: mongo:6.0
    container_name: marketplace-mongo
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  redis:
    image: redis:7.0-alpine
    container_name: marketplace-redis
    ports:
      - "6379:6379"

  backend-1:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    container_name: marketplace-backend-1
    environment:
      - PORT=3001
      - MONGODB_URI=mongodb://mongo:27017/marketplace
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=super-secret-jwt-key-for-marketplace-testing
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
    depends_on:
      - mongo
      - redis
    ports:
      - "3001:3001"

  backend-2:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    container_name: marketplace-backend-2
    environment:
      - PORT=3002
      - MONGODB_URI=mongodb://mongo:27017/marketplace
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=super-secret-jwt-key-for-marketplace-testing
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
    depends_on:
      - mongo
      - redis
    ports:
      - "3002:3002"

  nginx:
    image: nginx:alpine
    container_name: marketplace-lb
    ports:
      - "8080:80"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend-1
      - backend-2

  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile
    container_name: marketplace-frontend
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8080/api
      - NEXT_PUBLIC_SOCKET_URL=http://localhost:8080
      - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - nginx

volumes:
  mongo-data:
```

---

## 3. Nginx Load Balancer Configuration (`docker/nginx.conf`)

```nginx
events { worker_connections 1024; }

http {
  upstream nestjs_cluster {
    # ip_hash ensures sticky sessions for socket handshakes if polling is used
    ip_hash;
    server backend-1:3001;
    server backend-2:3002;
  }

  server {
    listen 80;

    location /api/ {
      proxy_pass http://nestjs_cluster;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /socket.io/ {
      proxy_pass http://nestjs_cluster;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "Upgrade";
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
  }
}
```

---

## 4. Database Seed & Fixture Strategy

For local automated testing and evaluation, a seed script (`npm run seed`) populates:
- **Customer User**: `customer@test.com` / `Password123!` (role: `customer`)
- **Provider User 1**: `provider1@test.com` / `Password123!` (role: `provider`)
- **Provider User 2**: `provider2@test.com` / `Password123!` (role: `provider`)
- **Sample Service Request**: Title: "Fix Kitchen Plumbing", Budget: $150, Status: `OPEN`
