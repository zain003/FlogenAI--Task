# Production Deployment Runbook — Real-Time Service Marketplace (FlogenAI)

This runbook documents the complete backend flow architecture and provides step-by-step instructions to deploy the entire multi-instance cluster on **Oracle Cloud (Always Free)** with the frontend on **Vercel** or containerized in Docker.

---

## 1. System Topology & Architecture

```
                                  Client Request
                             (HTTP REST / WebSocket)
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │      Nginx Load Balancer      │
                        │     (Port 80/8080, ip_hash)   │
                        └───────┬───────────────┬───────┘
                                │               │
                  Route /api/ & │               │ Route /api/ &
                  /socket.io/   │               │ /socket.io/
                                ▼               ▼
                     ┌──────────────────┐   ┌──────────────────┐
                     │ NestJS Instance 1│   │ NestJS Instance 2│
                     │   (Port 3001)    │   │   (Port 3002)    │
                     └─────────┬────────┘   └────────┬─────────┘
                               │                     │
                     ┌─────────┴─────────┐ ┌─────────┴─────────┐
                     │                   │ │                   │
                     ▼                   ▼ ▼                   ▼
        ┌─────────────────────────┐         ┌─────────────────────────┐
        │   Redis 7.0 Alpine      │         │   MongoDB 6.0 Database  │
        │ - Socket.IO Redis Adap. │         │ - Users & Auth          │
        │ - Distributed Locks     │         │ - Requests & Offers     │
        │ - Rate Limiting         │         │ - Payments & Events     │
        └─────────────────────────┘         │ - Chats & Messages      │
                     ▲                      └─────────────────────────┘
                     │ Webhook HMAC Verification
        ┌────────────┴────────────┐
        │ Stripe Payment Gateway  │
        └─────────────────────────┘
```

### Components & Responsibilities

| Service | Port | Role |
| :--- | :--- | :--- |
| **Nginx Load Balancer** | `8080` (or `80`) | Reverse proxy, sticky session routing (`ip_hash`), WebSocket upgrades (`Connection: "Upgrade"`). |
| **NestJS Backend 1** | `3001` | REST API, authenticated Socket.IO gateway, JWT authorization. |
| **NestJS Backend 2** | `3002` | Redundant REST API & Socket.IO instance for horizontal scaling. |
| **Redis 7.0 Alpine** | `6379` | Socket.IO Pub/Sub adapter broadcasting events across backend nodes; distributed mutex locks (`mkt:lock:request:<id>`). |
| **MongoDB 6.0** | `27017` | Persistent document storage for users, requests, offers, payments, chats, and idempotency keys. |
| **Next.js 16 Frontend** | `3000` | App Router, React 19 UI for Customer and Provider workflows. |

---

## 2. End-to-End Backend Flow

### A. Authentication & Session Initialization
1. Users register or log in via `POST /api/auth/register` or `POST /api/auth/login`.
2. Password hashed/verified using `bcrypt` (10 rounds).
3. JWT generated containing `{ sub: userId, email, role: 'customer' | 'provider' }`.
4. Socket.IO connection verified via JWT in handshake auth (`auth: { token }`).
5. Valid sockets automatically join `user:<id>` (private room) and `providers` (role broadcast room).

### B. Service Request Lifecycle
1. Customer publishes request via `POST /api/requests` (`title`, `description`, `budget`).
2. Persisted to MongoDB with status `OPEN`.
3. Dispatches `request:created` to the `providers` room via the Redis Pub/Sub adapter across all backend instances.

### C. Competing Offer Submission
1. Connected providers view open requests and submit offers via `POST /api/offers`.
2. Persisted to MongoDB with status `PENDING`.
3. Dispatches `offer:created` strictly to `user:<customerId>` so only the owning customer receives real-time updates.

### D. Concurrency-Guarded Offer Acceptance
1. Customer accepts an offer via `POST /api/offers/:id/accept`.
2. Backend acquires Redis distributed lock `mkt:lock:request:<requestId>` (`SET NX PX 10000`).
3. Executes atomic MongoDB conditional update: `findOneAndUpdate({ _id: requestId, status: 'OPEN' }, { $set: { status: 'ACCEPTED', acceptedOfferId: offerId } })`.
4. Marks selected offer `ACCEPTED`, marks peer offers `REJECTED`.
5. Releases Redis lock via atomic Lua script.
6. Emits `offer:accepted` to winning provider and `request:closed` to all other providers.

### E. Stripe Payments & Webhook Idempotency
1. Customer requests checkout session via `POST /api/payments/create-intent`.
2. Server queries MongoDB for accepted offer price (client-provided amounts are strictly ignored).
3. Webhook received at `POST /api/payments/webhook`:
   - Cryptographic signature verified against raw body (`stripe.webhooks.constructEvent`).
   - Idempotency verified against `processed_events` collection.
   - Updates payment to `SUCCEEDED` and request to `PAID`.
   - Dispatches `payment:succeeded` to Customer and Provider.

### F. Zero-Trust Real-Time Chat
1. Authenticated users join `/chat/[requestId]`.
2. Gateway verifies user ID matches `customerId` or `providerId` on the paid request.
3. Users exchange messages via `message:send` / `message:new`, persisted to MongoDB and synced via Redis.

---

## 3. Production Deployment Guide: Oracle Cloud (Always Free)

Oracle Cloud Infrastructure (OCI) provides up to **4 Ampere A1 OCPUs, 24 GB RAM, and 200 GB NVMe storage free forever**.

### Step 1: Provision the VM
1. Log in to [cloud.oracle.com](https://cloud.oracle.com).
2. Go to **Compute → Instances → Create Instance**.
3. **Image**: Ubuntu 24.04.
4. **Shape**: `VM.Standard.A1.Flex` (Ampere ARM), allocate **2 OCPUs** and **12 GB RAM**.
5. Ensure a **Public IPv4 address** is assigned.
6. Download the SSH private key (`.key` or `.pem`).

### Step 2: Configure Oracle Cloud Firewall
1. Open your VM's **Subnet → Default Security List → Add Ingress Rules**:
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: `TCP`
   - **Destination Port Range**: `80, 443, 8080`

### Step 3: Configure Host OS Firewall
Connect to your VM via SSH:
```bash
ssh -i "your-oracle-key.key" ubuntu@<ORACLE-PUBLIC-IP>
```
Unblock ports in Ubuntu's `iptables`:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8080 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### Step 4: Install Docker & Docker Compose
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu
newgrp docker
```

### Step 5: Clone & Configure
```bash
git clone https://github.com/zain003/FlogenAI--Task.git flogenai
cd flogenai
```

Create production `.env`:
```ini
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
JWT_SECRET=super-secure-production-jwt-key-for-oracle-cluster-2026
MONGODB_URI=mongodb://mongo:27017/marketplace
REDIS_HOST=redis
REDIS_PORT=6379
```

### Step 6: Start All Services
```bash
# Start backend cluster + mongo + redis + nginx
docker compose up -d --build mongo redis backend-1 backend-2 nginx
```

Verify all services:
```bash
docker compose ps
```

### Step 7: Free SSL & Domain (Cloudflare Tunnel)
To prevent mixed-content blocks when connecting from HTTPS frontends:
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared.deb
cloudflared tunnel --url http://localhost:8080
```
Use the provided `https://xxxx.trycloudflare.com` URL as your public API and Socket URL.

### Step 8: Frontend on Vercel
1. Import repository into Vercel with Root Directory set to `apps/frontend`.
2. Configure Environment Variables:
   - `NEXT_PUBLIC_API_URL`: `https://xxxx.trycloudflare.com/api`
   - `NEXT_PUBLIC_SOCKET_URL`: `https://xxxx.trycloudflare.com`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: `pk_test_...`
3. Deploy.
