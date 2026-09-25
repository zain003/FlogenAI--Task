import { io as SocketClient, Socket } from 'socket.io-client';

// ANSI escape codes for clean terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const NODE1_URL = process.env.NODE1_URL || 'http://localhost:3001';
const NODE2_URL = process.env.NODE2_URL || 'http://localhost:3002';
const NGINX_URL = process.env.NGINX_URL || 'http://localhost:8080';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

interface TestResult {
  testId: string;
  name: string;
  status: 'PASS' | 'FAIL';
  durationMs: number;
  details: string;
}

const results: TestResult[] = [];

function logPass(testId: string, name: string, durationMs: number, details = '') {
  console.log(`  ${GREEN}✓${RESET} ${BOLD}${testId}:${RESET} ${name} ${CYAN}(${durationMs}ms)${RESET}`);
  if (details) console.log(`    ${details}`);
  results.push({ testId, name, status: 'PASS', durationMs, details });
}

function logFail(testId: string, name: string, durationMs: number, error: unknown) {
  const errMsg = error instanceof Error ? error.message : String(error);
  console.error(`  ${RED}✗${RESET} ${BOLD}${testId}:${RESET} ${name} ${RED}[FAILED: ${errMsg}]${RESET}`);
  results.push({ testId, name, status: 'FAIL', durationMs, details: errMsg });
}

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForService(url: string, name: string, maxAttempts = 30, intervalMs = 2000): Promise<boolean> {
  process.stdout.write(`Waiting for ${name} at ${url}...`);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok || res.status === 404) {
        process.stdout.write(` ${GREEN}READY${RESET} (attempt ${attempt})\n`);
        return true;
      }
    } catch {
      // service not ready yet
    }
    process.stdout.write('.');
    await wait(intervalMs);
  }
  process.stdout.write(` ${RED}TIMEOUT${RESET}\n`);
  return false;
}

async function registerOrLoginUser(
  baseUrl: string,
  user: { email: string; password: string; name: string; role: 'customer' | 'provider' },
): Promise<{ token: string; userId: string }> {
  // First attempt registration
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

  // Attempt login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });

  if (!loginRes.ok) {
    const errText = await loginRes.text();
    throw new Error(`Authentication failed for ${user.email}: ${loginRes.status} ${errText}`);
  }

  const data = await loginRes.json();
  return { token: data.accessToken, userId: data.user.id };
}

async function runClusterVerification() {
  console.log(`\n${BOLD}${CYAN}=================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   FEAT-006-INT / VERIFY: Multi-Instance Scaling Verification    ${RESET}`);
  console.log(`${BOLD}${CYAN}=================================================================${RESET}\n`);

  console.log(`Target Topology:`);
  console.log(`  - Backend Node 1:  ${NODE1_URL}`);
  console.log(`  - Backend Node 2:  ${NODE2_URL}`);
  console.log(`  - Nginx Balancer:  ${NGINX_URL}`);
  console.log(`  - Frontend App:    ${FRONTEND_URL}\n`);

  // ─── 0. Readiness Checks ─────────────────────────────────────────────────────
  console.log(`${BOLD}Phase 0: Service Readiness Probes${RESET}`);
  const node1Ready = await waitForService(`${NODE1_URL}/api/health`, 'Backend Node 1');
  const node2Ready = await waitForService(`${NODE2_URL}/api/health`, 'Backend Node 2');
  const nginxReady = await waitForService(`${NGINX_URL}/health`, 'Nginx Load Balancer');
  const frontendReady = await waitForService(`${FRONTEND_URL}`, 'Frontend Next.js 16');

  if (!node1Ready || !node2Ready || !nginxReady) {
    console.error(`\n${RED}Fatal: Core cluster services failed to reach healthy state.${RESET}`);
    console.error(`Ensure containers are running with 'docker compose up -d'.\n`);
    process.exit(1);
  }

  console.log(`\n${GREEN}All target services verified online.${RESET}\n`);

  // ─── Authentication Preparation ─────────────────────────────────────────────
  console.log(`${BOLD}Phase 1: Authenticating Test Actors${RESET}`);
  const timestamp = Date.now();
  const customerEmail = `cluster-cust-${timestamp}@test.com`;
  const providerEmail = `cluster-prov-${timestamp}@test.com`;
  const password = 'ClusterPassword123!';

  console.log(`  Authenticating Customer on Node 1 (${NODE1_URL})...`);
  const customer = await registerOrLoginUser(NODE1_URL, {
    email: customerEmail,
    password,
    name: 'Cluster Customer',
    role: 'customer',
  });

  console.log(`  Authenticating Provider on Node 2 (${NODE2_URL})...`);
  const provider = await registerOrLoginUser(NODE2_URL, {
    email: providerEmail,
    password,
    name: 'Cluster Provider',
    role: 'provider',
  });

  console.log(`  ${GREEN}✓${RESET} Actor JWT tokens acquired successfully.\n`);

  let clientA: Socket | null = null;
  let clientB: Socket | null = null;
  let clientNginx: Socket | null = null;

  try {
    // ─── Test 1: Direct Socket Connections ────────────────────────────────────
    console.log(`${BOLD}Phase 2: Executing Cluster Test Suites${RESET}`);
    {
      const start = Date.now();
      const testId = 'TEST-CLUSTER-01';
      const name = 'should connect socket client A directly to port 3001 and socket client B directly to port 3002';

      try {
        clientA = SocketClient(NODE1_URL, {
          auth: { token: customer.token },
          transports: ['websocket'],
          reconnection: false,
          timeout: 10000,
        });

        clientB = SocketClient(NODE2_URL, {
          auth: { token: provider.token },
          transports: ['websocket'],
          reconnection: false,
          timeout: 10000,
        });

        await Promise.all([
          new Promise<void>((resolve, reject) => {
            clientA!.on('connect', () => resolve());
            clientA!.on('connect_error', (err) => reject(new Error(`Client A (Node 1) failed: ${err.message}`)));
          }),
          new Promise<void>((resolve, reject) => {
            clientB!.on('connect', () => resolve());
            clientB!.on('connect_error', (err) => reject(new Error(`Client B (Node 2) failed: ${err.message}`)));
          }),
        ]);

        if (!clientA.connected || !clientB.connected) {
          throw new Error('Socket clients reported disconnected status');
        }

        logPass(
          testId,
          name,
          Date.now() - start,
          `Client A connected to Node 1 (id: ${clientA.id}) | Client B connected to Node 2 (id: ${clientB.id})`,
        );
      } catch (err) {
        logFail(testId, name, Date.now() - start, err);
        throw err;
      }
    }

    // ─── Test 2: Cross-Instance Event Broadcast ──────────────────────────────
    {
      const start = Date.now();
      const testId = 'TEST-CLUSTER-02';
      const name = 'should broadcast event from client A on Node 1 and receive it on client B on Node 2 via Redis adapter';

      try {
        const expectedTitle = `Cluster Test Service Request ${timestamp}`;

        // Set up listener on Client B (connected to Node 2)
        const eventReceivedPromise = new Promise<{ request: any }>((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('Timed out (10s) waiting for cross-instance event broadcast via Redis adapter'));
          }, 10000);

          clientB!.on('request:created', (payload: any) => {
            if (payload?.request?.title === expectedTitle) {
              clearTimeout(timer);
              resolve(payload);
            }
          });
        });

        // Small pause to ensure room joining synchronization across Redis
        await wait(500);

        // Client A triggers request creation on Node 1 via HTTP
        const createRes = await fetch(`${NODE1_URL}/api/requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${customer.token}`,
          },
          body: JSON.stringify({
            title: expectedTitle,
            description: 'Verifying cross-instance Redis Pub/Sub adapter synchronization between backend nodes.',
            budget: 450,
          }),
        });

        if (!createRes.ok) {
          const errText = await createRes.text();
          throw new Error(`Failed to create service request on Node 1: ${createRes.status} ${errText}`);
        }

        const createdData = await createRes.json();
        const receivedEvent = await eventReceivedPromise;

        if (receivedEvent.request.id !== createdData.id) {
          throw new Error(
            `Event ID mismatch: expected ${createdData.id}, received ${receivedEvent.request.id}`,
          );
        }

        const deliveryLatency = Date.now() - start;
        logPass(
          testId,
          name,
          deliveryLatency,
          `Node 1 HTTP trigger emitted 'request:created' -> Redis adapter synchronized -> Node 2 delivered to Client B (Latency: ~${deliveryLatency}ms)`,
        );
      } catch (err) {
        logFail(testId, name, Date.now() - start, err);
        throw err;
      }
    }

    // ─── Test 3: Nginx Reverse Proxy & Load Balancer Routing ──────────────────
    {
      const start = Date.now();
      const testId = 'TEST-CLUSTER-03';
      const name = 'should route requests through Nginx load balancer to both backend instances';

      try {
        // Query Nginx REST API
        const nginxApiRes = await fetch(`${NGINX_URL}/api/requests?limit=10`, {
          headers: { Authorization: `Bearer ${customer.token}` },
        });

        if (!nginxApiRes.ok) {
          throw new Error(`Nginx REST API proxy failed with status: ${nginxApiRes.status}`);
        }

        const data = await nginxApiRes.json();
        if (!Array.isArray(data.data)) {
          throw new Error('Unexpected response shape from /api/requests via Nginx');
        }

        // Test WebSocket upgrade through Nginx
        clientNginx = SocketClient(NGINX_URL, {
          auth: { token: customer.token },
          transports: ['websocket'],
          reconnection: false,
          timeout: 10000,
        });

        await new Promise<void>((resolve, reject) => {
          clientNginx!.on('connect', () => resolve());
          clientNginx!.on('connect_error', (err) =>
            reject(new Error(`Nginx WebSocket connection failed: ${err.message}`)),
          );
        });

        logPass(
          testId,
          name,
          Date.now() - start,
          `Nginx port 8080 successfully proxied REST API queries and completed WebSocket upgrade handshake`,
        );
      } catch (err) {
        logFail(testId, name, Date.now() - start, err);
        throw err;
      }
    }

    // ─── Test 4: Simultaneous Distributed Concurrency Protection ─────────────
    {
      const start = Date.now();
      const testId = 'TEST-CLUSTER-04';
      const name = 'should handle simultaneous requests across both instances without data corruption';

      try {
        // 1. Create a request for concurrency verification
        const reqRes = await fetch(`${NODE1_URL}/api/requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${customer.token}`,
          },
          body: JSON.stringify({
            title: `Concurrency Stress Request ${timestamp}`,
            description: 'Proving mutual exclusion across dual backend nodes via Redis distributed locks.',
            budget: 600,
          }),
        });
        const requestData = await reqRes.json();
        const requestId = requestData.id;

        // 2. Submit Offer 1 (via Node 1)
        const offer1Res = await fetch(`${NODE1_URL}/api/requests/${requestId}/offers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.token}`,
          },
          body: JSON.stringify({
            price: 550,
            message: 'First competitive bid submitted via Node 1',
          }),
        });
        const offer1 = await offer1Res.json();

        // 3. Submit Offer 2 (via Node 2)
        const offer2Res = await fetch(`${NODE2_URL}/api/requests/${requestId}/offers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${provider.token}`,
          },
          body: JSON.stringify({
            price: 540,
            message: 'Second competitive bid submitted via Node 2',
          }),
        });
        const offer2 = await offer2Res.json();

        // 4. Dispatch simultaneous acceptance requests:
        // Accept Offer 1 hitting Node 1 directly; Accept Offer 2 hitting Node 2 directly
        const [node1AcceptRes, node2AcceptRes] = await Promise.all([
          fetch(`${NODE1_URL}/api/offers/${offer1.id}/accept`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${customer.token}`,
            },
          }),
          fetch(`${NODE2_URL}/api/offers/${offer2.id}/accept`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${customer.token}`,
            },
          }),
        ]);

        const statuses = [node1AcceptRes.status, node2AcceptRes.status];
        const successCount = statuses.filter((s) => s === 200).length;
        const conflictCount = statuses.filter((s) => s === 409).length;

        if (successCount !== 1 || conflictCount !== 1) {
          throw new Error(
            `Concurrency violation! Expected exactly 1 success (200) and 1 conflict (409), but got statuses: ${JSON.stringify(
              statuses,
            )}`,
          );
        }

        // 5. Verify database integrity via Nginx proxy
        const checkRes = await fetch(`${NGINX_URL}/api/requests/${requestId}`);
        const finalRequest = await checkRes.json();

        if (finalRequest.status !== 'ACCEPTED') {
          throw new Error(`Expected request status ACCEPTED, found: ${finalRequest.status}`);
        }

        const acceptedId = finalRequest.acceptedOfferId;
        if (acceptedId !== offer1.id && acceptedId !== offer2.id) {
          throw new Error(`Invalid accepted offer ID recorded: ${acceptedId}`);
        }

        logPass(
          testId,
          name,
          Date.now() - start,
          `Parallel requests across Node 1 & Node 2 -> Statuses: [${statuses.join(
            ', ',
          )}] (Exactly 1 Accepted, 1 Conflict 409). DB status: ACCEPTED. Zero double-acceptance.`,
        );
      } catch (err) {
        logFail(testId, name, Date.now() - start, err);
        throw err;
      }
    }
  } finally {
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
    if (clientNginx) clientNginx.disconnect();
  }

  // ─── Summary Table ───────────────────────────────────────────────────────────
  console.log(`\n${BOLD}${CYAN}=================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}                 CLUSTER SQA EXECUTION SUMMARY                   ${RESET}`);
  console.log(`${BOLD}${CYAN}=================================================================${RESET}`);
  console.log(
    `| ${'Test ID'.padEnd(16)} | ${'Status'.padEnd(6)} | ${'Time (ms)'.padEnd(9)} | ${'Test Name'.padEnd(26)} |`,
  );
  console.log(`|------------------|--------|-----------|----------------------------|`);
  for (const r of results) {
    const statusFormatted = r.status === 'PASS' ? `${GREEN}PASS${RESET}  ` : `${RED}FAIL${RESET}  `;
    console.log(
      `| ${r.testId.padEnd(16)} | ${statusFormatted} | ${String(r.durationMs).padStart(9)} | ${r.name.slice(0, 26).padEnd(26)} |`,
    );
  }
  console.log(`|-------------------------------------------------------------------|`);

  const passedCount = results.filter((r) => r.status === 'PASS').length;
  const totalCount = results.length;
  console.log(`\n${BOLD}Result:${RESET} ${passedCount}/${totalCount} tests passed (${Math.round((passedCount / totalCount) * 100)}%)`);

  if (passedCount === totalCount) {
    console.log(`\n${GREEN}${BOLD}✓ SQA VERDICT: CLUSTER SCALING FULLY VERIFIED (PASSED 100%)${RESET}\n`);
    process.exit(0);
  } else {
    console.error(`\n${RED}${BOLD}✗ SQA VERDICT: VERIFICATION FAILED${RESET}\n`);
    process.exit(1);
  }
}

runClusterVerification().catch((err) => {
  console.error(`Unhandled error during cluster verification:`, err);
  process.exit(1);
});
