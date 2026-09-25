# Code Standards — Real-Time Service Marketplace

## General Principles

- **Separation of Concerns**: Controllers handle HTTP routing and validation; services implement core domain logic; gateways handle WebSocket transport; repositories/models interact with storage.
- **Fail Fast & Explicitly**: Validate all incoming parameters at the network boundary. Reject malformed requests immediately with actionable HTTP 400 error payloads.
- **Never Trust Client Inputs**: Never trust a user ID, role, ownership tag, or payment amount sent by the client. Always extract identity from the verified JWT and verify ownership against the database.

## TypeScript

- Strict TypeScript mode enabled across both frontend and backend (`"strict": true`).
- No `any` type annotations; use narrow union types, explicit interfaces, or `unknown` with type narrowing.
- All function signatures, service methods, and API responses must have explicit return types.
- Centralize shared data models and DTO contracts in `000-shared-contracts.md` and shared package/folder.

## NestJS Backend Standards

- **DTO Validation**: Every endpoint must accept a dedicated DTO decorated with `class-validator` (`@IsString()`, `@IsEmail()`, `@IsNumber()`, `@Min()`, `@IsEnum()`, etc.).
- **Global Pipes**: Enable `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- **Authentication & Guards**:
  - Secure private routes with `@UseGuards(JwtAuthGuard, RolesGuard)`.
  - Use custom `@Roles('customer' | 'provider')` and `@CurrentUser()` decorators.
- **Exception Filters**: Return standard error structure across all HTTP endpoints:
  ```json
  {
    "statusCode": 400,
    "message": "Validation failed",
    "errors": ["budget must be greater than 0"],
    "timestamp": "2026-09-25T12:00:00.000Z",
    "path": "/api/requests"
  }
  ```
- **Logging**: Use NestJS built-in `Logger` with structured contextual messages; never use `console.log`.

## Database & MongoDB Standards

- **Schema Definitions**: Define schemas with `@Schema({ timestamps: true })` and explicit types.
- **Indexes**:
  - Unique index on `users.email`.
  - Compound index on `service_requests.status` and `service_requests.customerId`.
  - Compound index on `offers.requestId` and `offers.status`.
  - Unique index on `payments.stripePaymentIntentId`.
  - Unique index on `processed_events._id` (Stripe event ID).
- **Mandatory Pagination**: All list queries (`GET /requests`, `GET /requests/:id/offers`, `GET /conversations/:id/messages`) must enforce `limit` (max 50, default 20) and `page`/`cursor`. Returning unbounded arrays is forbidden.
- **Atomic Concurrency**: State transitions must use atomic operators (`findOneAndUpdate`, `$set`, `$setOnInsert`) checking pre-conditions (e.g. `status: 'OPEN'`).

## Redis Standards

- **Key Namespacing**: Format keys with prefixes: `mkt:lock:request:<id>`, `mkt:rate:<ip>`, etc.
- **Lock Discipline**: Always set a TTL (e.g., 5000ms–10000ms) on locks to prevent deadlocks during node crashes. Always release locks in a `finally` block using a Lua script that verifies the token.
- **Socket.IO Adapter**: Connect NestJS WebSocket gateways to `@socket.io/redis-adapter` using a dedicated sub/pub Redis client pair.

## Socket.IO Standards

- **Handshake Auth**: Reject unauthenticated connection attempts in `handleConnection` before socket events can be received.
- **Room Authorization**: Intercept `conversation:join` events and verify against MongoDB that the socket user is either `customerId` or `providerId` for that conversation.
- **Typed Payloads**: All emitted and received events must implement typed interfaces (`RequestCreatedEvent`, `OfferCreatedEvent`, `OfferAcceptedEvent`, `NewMessageEvent`).

## Stripe Payments Standards

- **Raw Body for Webhooks**: The Stripe webhook route (`/api/payments/webhook`) must receive the raw unparsed request buffer for signature verification via `stripe.webhooks.constructEvent`.
- **Zero Card Data**: Never accept or process raw card numbers on the backend; all card handling happens in Stripe Elements on the client.
- **Idempotency**: Check if the Stripe event ID has already been recorded in `processed_events` before running business logic.

## Next.js Frontend Standards

- **Minimalist Aesthetic**: Clean, responsive layout adhering to `context/ui-context.md`.
- **Component Hygiene**: Small, focused components; separate stateful container views from presentational UI.
- **Error Boundaries & Feedback**: Display clear toast/banner notifications for API errors and loading spinners during network requests.
- **WebSocket Reconnection**: Socket client must gracefully handle reconnections and auth token renewal.

## File Organization

```
apps/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/         # AuthController, AuthService, JwtStrategy, RolesGuard, DTOs
│   │   │   ├── requests/     # RequestsController, RequestsService, DTOs, Schemas
│   │   │   ├── offers/       # OffersController, OffersService, DTOs, Schemas
│   │   │   ├── payments/     # PaymentsController, PaymentsService, StripeService, Webhook
│   │   │   ├── chat/         # ChatController, ChatService, Schemas
│   │   │   ├── socket/       # MarketplaceGateway, RedisAdapter, HandshakeAuthGuard
│   │   │   └── redis/        # RedisService, DistributedLockService
│   │   ├── common/           # Filters, Guards, Decorators, Interceptors
│   │   └── main.ts
│   └── test/                 # E2E & Concurrency integration tests
├── frontend/
│   ├── src/
│   │   ├── app/              # App Router routes (login, register, requests, chat)
│   │   ├── components/       # UI components & forms
│   │   ├── context/          # AuthContext, SocketContext
│   │   └── lib/              # API client, Stripe helper, Socket client
│   └── tests/                # Vitest & React Testing Library fake DOM tests
└── docker/
    ├── docker-compose.yml
    └── nginx.conf
```
