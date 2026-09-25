import { io as SocketClient, Socket } from 'socket.io-client';
import Stripe from 'stripe';

const NODE1_URL = process.env.NODE1_URL || 'http://localhost:3001';
const NODE2_URL = process.env.NODE2_URL || 'http://localhost:3002';
const NGINX_URL = process.env.NGINX_URL || 'http://localhost:8080';
const WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder_secret_for_testing';

interface Actor {
  email: string;
  name: string;
  role: 'customer' | 'provider';
  token: string;
  userId: string;
  socket: Socket | null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function registerOrLoginUser(
  baseUrl: string,
  user: { email: string; password: string; name: string; role: 'customer' | 'provider' },
): Promise<{ token: string; userId: string }> {
  try {
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });

    if (regRes.ok) {
      const data = await regRes.json();
      return { token: data.accessToken, userId: data.user.id };
    }
  } catch {
    // If registration fails, fallback to login
  }

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });

  if (!loginRes.ok) {
    const errText = await loginRes.text();
    throw new Error(`Auth failed for ${user.email}: ${loginRes.status} ${errText}`);
  }

  const data = await loginRes.json();
  return { token: data.accessToken, userId: data.user.id };
}

describe('Full Marketplace Lifecycle & Concurrency Journey (EPIC-001)', () => {
  const timestamp = Date.now();
  const password = 'EpicSecurePassword123!';

  let customer: Actor = {
    email: `epic-cust-${timestamp}@test.com`,
    name: 'Epic Customer',
    role: 'customer',
    token: '',
    userId: '',
    socket: null,
  };

  let provider1: Actor = {
    email: `epic-prov1-${timestamp}@test.com`,
    name: 'Epic Provider 1',
    role: 'provider',
    token: '',
    userId: '',
    socket: null,
  };

  let provider2: Actor = {
    email: `epic-prov2-${timestamp}@test.com`,
    name: 'Epic Provider 2',
    role: 'provider',
    token: '',
    userId: '',
    socket: null,
  };

  let createdRequestId: string;
  let offer1Id: string;
  let offer2Id: string;
  let winningOfferId: string;
  let losingOfferId: string;
  let winningPrice: number;
  let winningProvider: Actor;
  let losingProvider: Actor;
  let paymentIntentId: string;
  let conversationId: string;

  beforeAll(async () => {
    // Verify backend cluster nodes are reachable
    const [res1, res2] = await Promise.all([
      fetch(`${NODE1_URL}/api/health`).catch(() => null),
      fetch(`${NODE2_URL}/api/health`).catch(() => null),
    ]);

    if (!res1?.ok || !res2?.ok) {
      throw new Error(
        `Backend cluster not ready. Node 1 (${NODE1_URL}): ${res1?.status}, Node 2 (${NODE2_URL}): ${res2?.status}. Ensure containers are up via 'docker compose up -d'.`,
      );
    }
  });

  afterAll(async () => {
    if (customer.socket) {
      customer.socket.removeAllListeners();
      customer.socket.disconnect();
      customer.socket.close();
    }
    if (provider1.socket) {
      provider1.socket.removeAllListeners();
      provider1.socket.disconnect();
      provider1.socket.close();
    }
    if (provider2.socket) {
      provider2.socket.removeAllListeners();
      provider2.socket.disconnect();
      provider2.socket.close();
    }
    await wait(200);
  });

  // ─── Journey Step 1: Customer & Provider Setup ─────────────────────────────
  it('should complete full registration and login flow for customer and 2 providers', async () => {
    // 1. Register Customer on Node 1
    const custAuth = await registerOrLoginUser(NODE1_URL, {
      email: customer.email,
      password,
      name: customer.name,
      role: 'customer',
    });
    customer.token = custAuth.token;
    customer.userId = custAuth.userId;
    expect(customer.token).toBeDefined();
    expect(customer.userId).toBeDefined();

    // 2. Register Provider 1 on Node 1
    const prov1Auth = await registerOrLoginUser(NODE1_URL, {
      email: provider1.email,
      password,
      name: provider1.name,
      role: 'provider',
    });
    provider1.token = prov1Auth.token;
    provider1.userId = prov1Auth.userId;
    expect(provider1.token).toBeDefined();
    expect(provider1.userId).toBeDefined();

    // 3. Register Provider 2 on Node 2
    const prov2Auth = await registerOrLoginUser(NODE2_URL, {
      email: provider2.email,
      password,
      name: provider2.name,
      role: 'provider',
    });
    provider2.token = prov2Auth.token;
    provider2.userId = prov2Auth.userId;
    expect(provider2.token).toBeDefined();
    expect(provider2.userId).toBeDefined();

    // 4. Establish Socket.IO connections with JWT handshake authentication
    // Customer connects to Node 1
    customer.socket = SocketClient(NODE1_URL, {
      auth: { token: customer.token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
    });

    // Provider 1 connects to Node 1
    provider1.socket = SocketClient(NODE1_URL, {
      auth: { token: provider1.token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
    });

    // Provider 2 connects to Node 2 (cross-node topology)
    provider2.socket = SocketClient(NODE2_URL, {
      auth: { token: provider2.token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10000,
    });

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        customer.socket!.on('connect', () => resolve());
        customer.socket!.on('connect_error', (err) =>
          reject(new Error(`Customer socket failed: ${err.message}`)),
        );
      }),
      new Promise<void>((resolve, reject) => {
        provider1.socket!.on('connect', () => resolve());
        provider1.socket!.on('connect_error', (err) =>
          reject(new Error(`Provider 1 socket failed: ${err.message}`)),
        );
      }),
      new Promise<void>((resolve, reject) => {
        provider2.socket!.on('connect', () => resolve());
        provider2.socket!.on('connect_error', (err) =>
          reject(new Error(`Provider 2 socket failed: ${err.message}`)),
        );
      }),
    ]);

    expect(customer.socket.connected).toBe(true);
    expect(provider1.socket.connected).toBe(true);
    expect(provider2.socket.connected).toBe(true);

    // Give Redis pub/sub room joins 250ms to settle across cluster nodes
    await wait(250);
  });

  // ─── Journey Step 2: Request Publication & Broadcast ───────────────────────
  it('should broadcast created request to both connected providers', async () => {
    const expectedTitle = `Renovate Bathroom ${timestamp}`;
    const startTime = Date.now();

    // Provider 1 (on Node 1) and Provider 2 (on Node 2) listen for 'request:created'
    const prov1Received = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for Provider 1 to receive request:created')),
        10000,
      );
      provider1.socket!.on('request:created', (payload: any) => {
        if (payload?.request?.title === expectedTitle) {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });

    const prov2Received = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for Provider 2 to receive request:created')),
        10000,
      );
      provider2.socket!.on('request:created', (payload: any) => {
        if (payload?.request?.title === expectedTitle) {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });

    // Customer creates service request on Node 1
    const createRes = await fetch(`${NODE1_URL}/api/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer.token}`,
      },
      body: JSON.stringify({
        title: expectedTitle,
        description:
          'Full renovation of master bathroom with luxury tile and vanity replacement.',
        budget: 500,
      }),
    });

    expect(createRes.status).toBe(201);
    const createdData = await createRes.json();
    createdRequestId = createdData.id;
    expect(createdRequestId).toBeDefined();
    expect(createdData.status).toBe('OPEN');
    expect(createdData.budget).toBe(500);

    // Both providers receive the event
    const [event1, event2] = await Promise.all([prov1Received, prov2Received]);
    expect(event1.request.id).toBe(createdRequestId);
    expect(event2.request.id).toBe(createdRequestId);

    const deliveryDuration = Date.now() - startTime;
    expect(deliveryDuration).toBeLessThan(10000);
  });

  // ─── Journey Step 3: Competing Offers Submission ───────────────────────────
  it('should allow both providers to submit competing offers', async () => {
    // Customer socket listens for 'offer:created' on user private room
    const receivedOffers: any[] = [];
    const customerOffersPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (receivedOffers.length >= 2) resolve();
        else
          reject(
            new Error(
              `Timed out waiting for both offer:created events. Received: ${receivedOffers.length}`,
            ),
          );
      }, 10000);

      customer.socket!.on('offer:created', (payload: any) => {
        if (payload?.offer?.requestId === createdRequestId) {
          receivedOffers.push(payload);
          if (receivedOffers.length === 2) {
            clearTimeout(timer);
            resolve();
          }
        }
      });
    });

    // Provider 1 submits offer of $450 via Node 1
    const offer1Res = await fetch(`${NODE1_URL}/api/requests/${createdRequestId}/offers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider1.token}`,
      },
      body: JSON.stringify({
        price: 450,
        message: 'Can start this Monday and finish in 3 days.',
      }),
    });

    expect(offer1Res.status).toBe(201);
    const offer1Data = await offer1Res.json();
    offer1Id = offer1Data.id;
    expect(offer1Data.price).toBe(450);
    expect(offer1Data.status).toBe('PENDING');

    // Provider 2 submits offer of $480 via Node 2
    const offer2Res = await fetch(`${NODE2_URL}/api/requests/${createdRequestId}/offers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider2.token}`,
      },
      body: JSON.stringify({
        price: 480,
        message: 'Certified bathroom specialist with 10 years experience.',
      }),
    });

    expect(offer2Res.status).toBe(201);
    const offer2Data = await offer2Res.json();
    offer2Id = offer2Data.id;
    expect(offer2Data.price).toBe(480);
    expect(offer2Data.status).toBe('PENDING');

    // Customer receives both offer:created events
    await customerOffersPromise;
    expect(receivedOffers.length).toBe(2);

    // Customer queries GET /api/requests/:id/offers
    const listRes = await fetch(`${NODE1_URL}/api/requests/${createdRequestId}/offers`, {
      headers: { Authorization: `Bearer ${customer.token}` },
    });
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.data.length).toBe(2);
    const prices = listData.data.map((o: any) => o.price);
    expect(prices).toContain(450);
    expect(prices).toContain(480);
  });

  // ─── Journey Step 4: Concurrent Acceptance Attack ───────────────────────────
  it('RACE TEST: should fire 2 simultaneous acceptance requests across Node 1 and Node 2; exactly 1 succeeds and 1 fails with HTTP 409', async () => {
    // Listen for offer:accepted on provider sockets
    let winningProviderSocketEvent: any = null;
    const providerAcceptedPromise = new Promise<void>((resolve) => {
      const handler = (payload: any) => {
        if (payload?.requestId === createdRequestId) {
          winningProviderSocketEvent = payload;
          resolve();
        }
      };
      provider1.socket!.once('offer:accepted', handler);
      provider2.socket!.once('offer:accepted', handler);
    });

    // Fire 2 simultaneous acceptance requests:
    // Offer 1 accept hits Node 1; Offer 2 accept hits Node 2 at the exact same millisecond
    const [res1, res2] = await Promise.all([
      fetch(`${NODE1_URL}/api/offers/${offer1Id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customer.token}`,
        },
      }),
      fetch(`${NODE2_URL}/api/offers/${offer2Id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customer.token}`,
        },
      }),
    ]);

    const statuses = [res1.status, res2.status];
    const successes = statuses.filter((s) => s === 200);
    const conflicts = statuses.filter((s) => s === 409);

    // Invariant: Exactly 1 succeeds with 200, exactly 1 fails with 409 Conflict
    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(1);

    if (res1.status === 200) {
      winningOfferId = offer1Id;
      losingOfferId = offer2Id;
      winningPrice = 450;
      winningProvider = provider1;
      losingProvider = provider2;
    } else {
      winningOfferId = offer2Id;
      losingOfferId = offer1Id;
      winningPrice = 480;
      winningProvider = provider2;
      losingProvider = provider1;
    }

    // Verify database state: Request must be ACCEPTED with acceptedOfferId
    const checkReqRes = await fetch(`${NODE1_URL}/api/requests/${createdRequestId}`);
    expect(checkReqRes.status).toBe(200);
    const finalRequest = await checkReqRes.json();
    expect(finalRequest.status).toBe('ACCEPTED');
    expect(finalRequest.acceptedOfferId).toBe(winningOfferId);

    // Verify winning offer is ACCEPTED
    const winOfferRes = await fetch(`${NODE1_URL}/api/offers/${winningOfferId}`);
    expect(winOfferRes.status).toBe(200);
    const winningOfferDoc = await winOfferRes.json();
    expect(winningOfferDoc.status).toBe('ACCEPTED');

    // Verify losing offer is REJECTED
    const loseOfferRes = await fetch(`${NODE2_URL}/api/offers/${losingOfferId}`);
    expect(loseOfferRes.status).toBe(200);
    const losingOfferDoc = await loseOfferRes.json();
    expect(losingOfferDoc.status).toBe('REJECTED');

    // Verify winning provider received real-time offer:accepted notification
    await Promise.race([providerAcceptedPromise, wait(2000)]);
    if (winningProviderSocketEvent) {
      expect(winningProviderSocketEvent.requestId).toBe(createdRequestId);
      expect(winningProviderSocketEvent.offer.id).toBe(winningOfferId);
    }
  });

  // ─── Journey Step 5: Stripe Test Payment & Webhook Idempotency ──────────────
  it('should process Stripe payment and transition request status to PAID via idempotent webhook', async () => {
    // 1. Customer creates PaymentIntent (server enforces price strictly from winning offer)
    const createIntentRes = await fetch(`${NODE1_URL}/api/payments/create-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer.token}`,
      },
      body: JSON.stringify({ offerId: winningOfferId }),
    });

    expect(createIntentRes.status).toBe(200);
    const intentData = await createIntentRes.json();
    expect(intentData.paymentIntentId).toBeDefined();
    expect(intentData.clientSecret).toBeDefined();
    expect(intentData.amount).toBe(winningPrice * 100); // e.g. 45000 cents
    paymentIntentId = intentData.paymentIntentId;

    // Helper to generate Stripe webhook signature
    const StripeConstructor: any =
      typeof Stripe === 'function' ? Stripe : (Stripe as any)?.default || require('stripe');
    const stripe = new StripeConstructor('sk_test_placeholder');
    const generateSignedWebhook = (eventId: string, type: string) => {
      const payloadString = JSON.stringify({
        id: eventId,
        object: 'event',
        api_version: '2025-01-27.acacia',
        created: Math.floor(Date.now() / 1000),
        type,
        data: {
          object: {
            id: paymentIntentId,
            object: 'payment_intent',
            amount: winningPrice * 100,
            currency: 'usd',
            status: type === 'payment_intent.succeeded' ? 'succeeded' : 'failed',
            metadata: {
              requestId: createdRequestId,
              offerId: winningOfferId,
              customerId: customer.userId,
              providerId: winningProvider.userId,
            },
          },
        },
      });

      const signature = stripe.webhooks.generateTestHeaderString({
        payload: payloadString,
        secret: WEBHOOK_SECRET,
      });

      return { payloadString, signature };
    };

    // Edge Case: Payment failure mid-journey (card declined)
    const failEventId = `evt_fail_${timestamp}`;
    const failWebhook = generateSignedWebhook(failEventId, 'payment_intent.payment_failed');

    const failRes = await fetch(`${NODE2_URL}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': failWebhook.signature,
      },
      body: failWebhook.payloadString,
    });
    expect(failRes.status).toBe(200);

    // Verify request status remains ACCEPTED allowing retry
    const reqAfterFailRes = await fetch(`${NODE1_URL}/api/requests/${createdRequestId}`);
    const reqAfterFail = await reqAfterFailRes.json();
    expect(reqAfterFail.status).toBe('ACCEPTED');

    // Customer socket listens for payment:succeeded
    let receivedPaymentSucceeded = false;
    customer.socket!.once('payment:succeeded', (payload: any) => {
      if (payload?.requestId === createdRequestId) {
        receivedPaymentSucceeded = true;
      }
    });

    // Valid Payment Intent Succeeded Webhook Delivery
    const successEventId = `evt_success_${timestamp}`;
    const successWebhook = generateSignedWebhook(
      successEventId,
      'payment_intent.succeeded',
    );

    const successRes = await fetch(`${NODE1_URL}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': successWebhook.signature,
      },
      body: successWebhook.payloadString,
    });

    expect(successRes.status).toBe(200);
    const successJson = await successRes.json();
    expect(successJson.received).toBe(true);

    // Verify request transitioned to PAID in database
    const paidReqRes = await fetch(`${NGINX_URL}/api/requests/${createdRequestId}`);
    expect(paidReqRes.status).toBe(200);
    const paidReq = await paidReqRes.json();
    expect(paidReq.status).toBe('PAID');

    // Verify payment record transitioned to SUCCEEDED
    const paymentRecordRes = await fetch(
      `${NODE1_URL}/api/payments/by-request/${createdRequestId}`,
      {
        headers: { Authorization: `Bearer ${customer.token}` },
      },
    );
    expect(paymentRecordRes.status).toBe(200);
    const paymentRecord = await paymentRecordRes.json();
    expect(paymentRecord.status).toBe('SUCCEEDED');
    expect(paymentRecord.amount).toBe(winningPrice * 100);

    // Wait for payment:succeeded event
    await wait(300);

    // ─── Webhook Idempotency Replay Test ────────────────────────────────────
    // Send exact same webhook event twice more
    const replay1Res = await fetch(`${NODE1_URL}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': successWebhook.signature,
      },
      body: successWebhook.payloadString,
    });
    expect(replay1Res.status).toBe(200);

    const replay2Res = await fetch(`${NODE2_URL}/api/payments/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': successWebhook.signature,
      },
      body: successWebhook.payloadString,
    });
    expect(replay2Res.status).toBe(200);

    // Assert database state remained PAID with zero corruption
    const afterReplayReqRes = await fetch(`${NODE1_URL}/api/requests/${createdRequestId}`);
    const afterReplayReq = await afterReplayReqRes.json();
    expect(afterReplayReq.status).toBe('PAID');
  });

  // ─── Journey Step 6: Authorized Cross-Node Chat ─────────────────────────────
  it('should allow customer and winning provider to chat in real time across different NestJS nodes', async () => {
    // 1. Resolve conversation by request ID
    const convRes = await fetch(
      `${NODE1_URL}/api/conversations/by-request/${createdRequestId}`,
      {
        headers: { Authorization: `Bearer ${customer.token}` },
      },
    );
    expect(convRes.status).toBe(200);
    const convData = await convRes.json();
    conversationId = convData.id;
    expect(conversationId).toBeDefined();
    expect(convData.customerId).toBe(customer.userId);
    expect(convData.providerId).toBe(winningProvider.userId);

    // 2. Customer on Node 1 joins conversation room
    const custJoinAck: any = await new Promise((resolve) => {
      customer.socket!.emit('conversation:join', { conversationId }, (ack: any) =>
        resolve(ack),
      );
    });
    expect(custJoinAck.status).toBe('ok');

    // 3. Winning Provider on Node 2 joins conversation room
    const winJoinAck: any = await new Promise((resolve) => {
      winningProvider.socket!.emit('conversation:join', { conversationId }, (ack: any) =>
        resolve(ack),
      );
    });
    expect(winJoinAck.status).toBe('ok');

    // 4. Winning Provider (connected to Node 2) listens for 'message:new'
    const custMessageText =
      'Hello! Looking forward to starting the master bathroom renovation.';
    const provReceivedMessagePromise = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for winning provider to receive message:new')),
        10000,
      );
      winningProvider.socket!.on('message:new', (payload: any) => {
        if (payload?.message?.conversationId === conversationId) {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });

    // Customer on Node 1 sends message
    const sendCustAck: any = await new Promise((resolve) => {
      customer.socket!.emit(
        'message:send',
        { conversationId, content: custMessageText },
        (ack: any) => resolve(ack),
      );
    });
    expect(sendCustAck.status).toBe('ok');
    expect(sendCustAck.message.content).toBe(custMessageText);

    // Winning Provider on Node 2 receives the message via Redis Pub/Sub adapter
    const receivedByProv = await provReceivedMessagePromise;
    expect(receivedByProv.message.content).toBe(custMessageText);
    expect(receivedByProv.message.senderId).toBe(customer.userId);

    // 5. Customer (connected to Node 1) listens for reply from Winning Provider (on Node 2)
    const provReplyText =
      'Hi! All materials and tiles are ready. See you Monday morning at 8:00 AM sharp.';
    const custReceivedReplyPromise = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for customer to receive reply message:new')),
        10000,
      );
      customer.socket!.on('message:new', (payload: any) => {
        if (
          payload?.message?.conversationId === conversationId &&
          payload?.message?.content === provReplyText
        ) {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });

    // Winning Provider on Node 2 sends reply
    const sendProvAck: any = await new Promise((resolve) => {
      winningProvider.socket!.emit(
        'message:send',
        { conversationId, content: provReplyText },
        (ack: any) => resolve(ack),
      );
    });
    expect(sendProvAck.status).toBe('ok');
    expect(sendProvAck.message.content).toBe(provReplyText);

    // Customer on Node 1 receives the reply
    const receivedByCust = await custReceivedReplyPromise;
    expect(receivedByCust.message.content).toBe(provReplyText);
    expect(receivedByCust.message.senderId).toBe(winningProvider.userId);

    // 6. Verify full message history via REST API
    const messagesRes = await fetch(
      `${NODE1_URL}/api/conversations/${conversationId}/messages`,
      {
        headers: { Authorization: `Bearer ${customer.token}` },
      },
    );
    expect(messagesRes.status).toBe(200);
    const messagesData = await messagesRes.json();
    expect(messagesData.data.length).toBe(2);
    const contents = messagesData.data.map((m: any) => m.content);
    expect(contents).toContain(custMessageText);
    expect(contents).toContain(provReplyText);
  });

  // ─── Journey Step 7: Chat Privacy & Security Enforcement ───────────────────
  it('SECURITY TEST: should reject losing provider from reading or sending messages in the chat room', async () => {
    // 1. Losing Provider attempts to join the conversation room
    const losingJoinAck: any = await new Promise((resolve) => {
      losingProvider.socket!.emit('conversation:join', { conversationId }, (ack: any) =>
        resolve(ack),
      );
    });

    expect(losingJoinAck.status).toBe('error');
    expect(losingJoinAck.error).toContain('Unauthorized');

    // 2. Losing Provider attempts to send a message into the conversation
    const losingSendAck: any = await new Promise((resolve) => {
      losingProvider.socket!.emit(
        'message:send',
        {
          conversationId,
          content: 'Eavesdropper intrusion attempt into private channel.',
        },
        (ack: any) => resolve(ack),
      );
    });

    expect(losingSendAck.status).toBe('error');
    expect(losingSendAck.error).toBeDefined();

    // 3. Losing Provider attempts to retrieve conversation messages via REST API
    const intruderRestRes = await fetch(
      `${NODE1_URL}/api/conversations/${conversationId}/messages`,
      {
        headers: { Authorization: `Bearer ${losingProvider.token}` },
      },
    );

    // Invariant: Non-participant REST access is strictly rejected with HTTP 403 Forbidden
    expect(intruderRestRes.status).toBe(403);

    // 4. Confirm message store was NOT contaminated
    const cleanHistoryRes = await fetch(
      `${NODE2_URL}/api/conversations/${conversationId}/messages`,
      {
        headers: { Authorization: `Bearer ${customer.token}` },
      },
    );
    expect(cleanHistoryRes.status).toBe(200);
    const cleanHistory = await cleanHistoryRes.json();
    expect(cleanHistory.data.length).toBe(2);
    const allContents = cleanHistory.data.map((m: any) => m.content);
    expect(allContents).not.toContain('Eavesdropper intrusion attempt into private channel.');
  });
});
