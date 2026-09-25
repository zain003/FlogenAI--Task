# FEAT-005-BE — Chat Persistence & Conversation Model (P0)

**Layer**: Backend  
**Goal**: Persist conversations and messages in MongoDB, enforce server-side participant authorization, and expose paginated chat history.

## Depends on
`FEAT-003-VERIFY-offers.md`, `000-shared-contracts.md`

## Context pack
```typescript
export interface ConversationEntity {
  id: string;
  requestId: string;
  customerId: string;
  providerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageEntity {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}
```

## Consumes
```typescript
GET /api/requests/:id (param: id) => Promise<ServiceRequestEntity>
```

## Provides / Exposes
```typescript
GET  /api/conversations/by-request/:requestId (auth: Customer | Provider) => Promise<ConversationEntity>
GET  /api/conversations/:id/messages           (auth: Customer | Provider, query: { page?: number; limit?: number }) => Promise<PaginatedResponse<MessageEntity>>
POST /api/conversations/ensure                 (internal/service) => Promise<ConversationEntity>
```

## Scope (In)
- Mongoose schemas `conversations` (unique index on `requestId`) and `messages` (compound index on `conversationId, createdAt`).
- Automatic creation/resolution of `Conversation` when an offer is accepted.
- Enforcing that only the customer or provider of that conversation can retrieve messages.
- Pagination on message history (limit default 30, max 50).
- Saving chat messages to MongoDB before or upon broadcast.

## Scope (Out)
- WebSocket gateway transmission (`FEAT-005-INT`).
- Rich text formatting or attachments (`Out of assessment scope`).

## Tech / files to touch
- `apps/backend/src/modules/chat/chat.controller.ts`
- `apps/backend/src/modules/chat/chat.service.ts`
- `apps/backend/src/modules/chat/schemas/conversation.schema.ts`
- `apps/backend/src/modules/chat/schemas/message.schema.ts`

## Nonfunctional requirements
- Security: Cross-tenant / unauthorized access to conversation history returns HTTP 403 Forbidden.
- Performance: Message history index scan `< 50ms`.
- Message sanitization: trim whitespace and reject empty string payloads.

## Tests to write FIRST
1. `should create or return existing conversation for accepted request`
2. `should allow customer participant to fetch conversation messages`
3. `should allow provider participant to fetch conversation messages`
4. `should reject third-party user attempting to fetch conversation messages with HTTP 403`
5. `should paginate messages in reverse chronological order`
6. `should persist message entity in database with sender ID and timestamp`

## Implementation steps
1. Define Mongoose schemas for `Conversation` and `Message`.
2. Implement `ChatService.getOrCreateConversation(requestId, customerId, providerId)`.
3. Implement `ChatService.saveMessage(conversationId, senderId, content)`.
4. Implement `ChatService.getMessages(conversationId, userId, pagination)`: verify user is participant, fetch messages with `.sort({ createdAt: -1 })`.
5. Expose REST endpoints in `ChatController` with `JwtAuthGuard`.

## Acceptance criteria
- [ ] Participant retrieves historical messages for their accepted service request.
- [ ] Non-participant caller receives HTTP 403 Forbidden.
- [ ] Message history endpoint enforces pagination and returns total counts.

## Definition of Done
- [ ] Unit and API tests pass 100%.
- [ ] Clean typecheck and linting.
- [ ] Test report generated in `feature-test-reports/FEAT-005-test-report.md`.

## Edge cases to handle
- Request not yet accepted: conversation does not exist, return HTTP 404 or 400.

## Pre-flight check
Confirm `FEAT-003-VERIFY-offers.md` is verified.

## What's next
- `FEAT-005-FE-chat.md` and `FEAT-005-INT-chat-realtime.md`.

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
