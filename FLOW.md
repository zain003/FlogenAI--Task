# Real-Time Service Marketplace (FlogenAI) — Manual Testing Flow & E2E Walkthrough

> **About this Guide:** This document provides a complete, step-by-step manual testing runbook for the Real-Time Service Marketplace (FlogenAI). It demonstrates how to manually test the complete marketplace lifecycle journey across distributed backend instances, including real-time Socket.IO broadcasts, Redis distributed locks, Stripe test payments, and zero-trust chat.

---

## 1. System Topology & Active Endpoints

All services are orchestrated via Docker Compose and run concurrently:

| Service Component | URL / Address | Primary Role |
| :--- | :--- | :--- |
| **Next.js 16 Frontend** | [`http://localhost:3000`](http://localhost:3000) | App Router, React 19 UI for Customer & Provider |
| **Nginx Load Balancer** | [`http://localhost:8080`](http://localhost:8080) | Reverse proxy, sticky sessions (`ip_hash`), WebSocket upgrades |
| **NestJS Backend Node 1** | [`http://localhost:3001`](http://localhost:3001) | REST API & Socket.IO instance 1 |
| **NestJS Backend Node 2** | [`http://localhost:3002`](http://localhost:3002) | REST API & Socket.IO instance 2 |
| **Redis 7.0 Cache & Broker** | `localhost:6379` | Socket.IO Pub/Sub adapter, distributed mutex locks, rate limiting |
| **MongoDB 6.0 Database** | `localhost:27017` | Persistent storage (`marketplace` database) |

---

## 2. Quick Environment Health Check

Before starting, verify all 6 Docker containers are running and healthy:

```bash
docker ps
```

You should see `marketplace-mongo`, `marketplace-redis`, `marketplace-backend-1`, `marketplace-backend-2`, `marketplace-lb`, and `marketplace-frontend` with status `Up (healthy)`.

If the containers are not running, start them with:
```bash
docker compose up -d
```

---

## 3. Recommended Multi-Actor Browser Setup

To observe real-time WebSocket events streaming live without manual page reloads:

1. **Window A (Standard Window / Chrome):** Designate as **Customer Actor** (Alice).
2. **Window B (Incognito / Private Window or Edge/Firefox):** Designate as **Provider Actor** (Bob).

> **Why separate windows?** This keeps `localStorage` authentication tokens isolated so both actors remain logged in concurrently.

---

## 4. End-to-End Manual Testing Walkthrough

```
[Customer Window]                                       [Provider Window]
       │                                                        │
1. Register as Customer ─────────────────────────────► 1. Register as Provider
       │                                                        │
2. Post Service Request ──(Socket.IO request:created)─► 2. Request appears on feed
       │                                                        │
3. Offer appears live   ◄──(Socket.IO offer:created)─── 3. Submit competing offer
       │                                                        │
4. Accept Offer (Lock)  ──(Socket.IO offer:accepted)──► 4. Offer accepted alert
       │                                                        │
5. Stripe Checkout      ──(Stripe Webhook -> PAID)────► 5. Chat unlocked
       │                                                        │
6. Send Chat Message    ◄──(Socket.IO message:new)────► 6. Real-time reply
```

---

### Step 1: User Registration & Session Initialization

#### A. In Window A (Customer Actor):
1. Navigate to: [`http://localhost:3000/register`](http://localhost:3000/register)
2. Fill out the registration form:
   - **Full Name:** `Alice Customer`
   - **Email:** `alice@test.com`
   - **Password:** `Password123!`
   - **Role:** Select the **Customer** pill
3. Click **Create Account**.
4. **Verification:**
   - Automatically redirected to `/customer/requests`.
   - The top navigation bar displays a dynamic role badge: `CUSTOMER` (indigo).
   - A pulsing green dot displays next to **Live**, confirming an authenticated Socket.IO connection.

#### B. In Window B (Provider Actor):
1. Navigate to: [`http://localhost:3000/register`](http://localhost:3000/register)
2. Fill out the registration form:
   - **Full Name:** `Bob Provider`
   - **Email:** `bob@test.com`
   - **Password:** `Password123!`
   - **Role:** Select the **Provider** pill
3. Click **Create Account**.
4. **Verification:**
   - Automatically redirected to the marketplace feed at `/provider/browse`.
   - The top navigation bar displays a dynamic role badge: `PROVIDER` (amber).
   - Connected to Socket.IO and auto-joined to room `providers`.

---

### Step 2: Customer Publishes a Service Request

1. In **Window A (Customer)** at `/customer/requests`:
2. In the **Create Service Request** card on the left panel, enter:
   - **Service Title:** `Emergency Kitchen Pipe Repair`
   - **Description:** `Urgent repair needed for broken P-trap and leaking drainage pipe under kitchen sink.`
   - **Budget (USD):** `250.00`
3. Click **Publish Request**.

#### Real-Time Verification:
- **In Window A:** The new request is appended to the customer's active requests list with status `OPEN`.
- **In Window B (Provider):** Without refreshing the page, look at `/provider/browse`. The request `Emergency Kitchen Pipe Repair` instantly appears at the top of the feed via the `request:created` event broadcast through Redis Pub/Sub adapter.

---

### Step 3: Provider Submits a Competing Offer

1. In **Window B (Provider)** at `/provider/browse`:
2. Find the card for `Emergency Kitchen Pipe Repair` and click **View / Make Offer** (navigates to `/requests/[id]`).
3. Click the **Submit Offer** button to open the modal dialog.
4. Enter offer details:
   - **Offer Price (USD):** `220.00` (must be $\ge \$1.00$)
   - **Proposal Message:** `I am a licensed master plumber. I have copper parts in my van and can arrive within 45 minutes.`
5. Click **Send Offer**.

#### Real-Time Verification:
- **In Window B:** Modal closes with a success indicator.
- **In Window A (Customer):** Look at Window A on the customer's request details screen.
  - A banner immediately pulses: `"A new offer just arrived in real time!"`.
  - Bob's offer card for **$220.00** appears live in the incoming offers list without a page refresh!

---

### Step 4: Concurrency-Guarded Offer Acceptance

1. In **Window A (Customer)** on the request detail page:
2. Under **Incoming Offers**, review Bob's offer and click **Accept Offer**.
3. **What Happens Behind the Scenes:**
   - Backend acquires Redis distributed lock `mkt:lock:request:<requestId>` with a 10s TTL.
   - Executes atomic MongoDB conditional update: `findOneAndUpdate({ _id: requestId, status: 'OPEN' })`.
   - Marks Bob's offer as `ACCEPTED`.
   - Marks all other peer offers on this request as `REJECTED`.
   - Releases the Redis lock via atomic Lua script.
   - Emits `offer:accepted` to Bob's private room and `request:closed` to all other providers.
4. **Verification:**
   - In **Window A:** Request status updates to `ACCEPTED`, and a green **Pay $220.00** button appears.
   - In **Window B:** Bob's screen updates to show his offer is accepted.

---

### Step 5: Stripe Test Mode Escrow Payment

1. In **Window A (Customer)**:
2. Click **Pay $220.00** to open the Stripe Checkout modal.
3. Notice that the monetary amount ($220.00) is calculated and locked strictly by the backend.
4. Enter the Stripe Sandbox test credentials:
   - **Card Number:** `4242 4242 4242 4242`
   - **Expiration:** Any future date (e.g. `12/28`)
   - **CVC:** `123`
   - **ZIP:** `90210`
5. Click **Pay $220.00**.

#### Webhook Idempotency & State Reconciliation:
- Stripe triggers `payment_intent.succeeded`.
- The NestJS webhook receiver (`/api/payments/webhook`) cryptographically verifies the raw-body HMAC-SHA256 signature.
- Checks `processed_events` table for idempotency.
- Transitions payment status to `SUCCEEDED` and request status to `PAID`.
- Dispatches `payment:succeeded` over Socket.IO to both Customer and Provider.
- **Verification:** Both Window A and Window B display the green banner:
  **"Payment Secured & Escrowed — Chat Unlocked"**.

---

### Step 6: Real-Time Chat (Zero-Trust Room Isolation)

1. In **Window A (Customer)**: Click **Open Chat** (navigates to `/chat/[requestId]`).
2. In **Window B (Provider)**: Click **Open Chat** (navigates to `/chat/[requestId]`).
3. **Live Messaging Test:**
   - In Window A, type: `"Hello Bob! The front gate entry code is 1234. Let me know when you arrive."` and press **Enter**.
   - In Window B, Bob sees the message appear instantly over WebSocket via Redis Pub/Sub adapter!
   - In Window B, reply: `"Got it Alice, parking outside now!"` and press **Enter**.
   - In Window A, Alice receives the reply in real time.
4. **Persistence Verification:**
   - Press **F5** (refresh) in both browser windows.
   - The entire message history reloads from MongoDB in clean chronological order.

---

### Step 7: Negative Security & Access Boundary Testing

Test that the platform enforces zero-trust boundaries:

1. **Role Boundary Check:**
   - Try navigating to `/provider/browse` in Window A (Customer role).
   - **Result:** Client route guard automatically redirects customer back to `/customer/requests`.
2. **Third-Party Eavesdropping Check:**
   - Open a third browser window (Window C) and register as a new provider `charlie@test.com`.
   - Try accessing `/chat/[requestId]` for Alice and Bob's job.
   - **Result:** Server-side room authorization rejects Charlie with HTTP 403 Forbidden / error callback. Charlie cannot read or join Alice and Bob's conversation.
3. **Double-Acceptance Attack Check:**
   - Try calling `POST /api/offers/:id/accept` on a request that has already been accepted or paid.
   - **Result:** Backend rejects with HTTP 409 Conflict.

---

## 5. Automated Verification & Cluster Diagnostic Commands

You can run automated test scripts at any time to verify system integrity:

```bash
# 1. Run the full 7-step marketplace lifecycle journey test
npm run test:e2e

# 2. Run the multi-instance cluster synchronization & concurrency race test
npm run verify:cluster

# 3. Run the full backend test suite (21 suites, 222+ tests)
npm run test:backend

# 4. Run the frontend component fake DOM test suite (14 suites, 77+ tests)
npm run test:ui

# 5. Stream live logs from both NestJS backend instances
docker compose logs -f backend-1 backend-2
```

---

## 6. Tear Down & Reset

To stop the containers and clean up the database state:

```bash
# Stop containers while preserving data volume
docker compose down

# Stop containers and wipe MongoDB/Redis volumes for a fresh state
docker compose down -v
```
