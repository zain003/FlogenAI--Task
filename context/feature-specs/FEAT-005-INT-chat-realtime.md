# FEAT-005-INT — Real-Time Chat Gateway & Room Authorization (P0)

**Layer**: Integration  
**Goal**: Implement real-time WebSocket messaging with strict server-side room authorization and cluster-wide Redis broadcast.

## Depends on
`FEAT-005-BE-chat.md`, `FEAT-002-INT-requests-realtime.md`, `000-shared-contracts.md`

## Context pack
```typescript
export interface ClientToServerEvents {
  'conversation:join': (payload: { conversationId: string }, callback: (res: { status: 'ok' | 'error'; message?: string }) => void) => void;
  'message:send': (payload: { conversationId: string; content: string }, callback: (res: { status: 'ok' | 'error'; message?: MessageEntity }) => void) => void;
}

export interface ServerToClientEvents {
  'message:new': (payload: { message: MessageEntity }) => void;
}
```

## Consumes
```typescript
POST /api/conversations/ensure (internal) => Promise<ConversationEntity>
```

## Provides / Exposes
```typescript
// Socket.IO Room & Events
Room: "conversation:<conversationId>"
Event (C -> S): "conversation:join"
Event (C -> S): "message:send"
Event (S -> C): "message:new"
```

## Scope (In)
- Enforcing server-side authorization on `conversation:join`:
  - Socket user ID extracted from authenticated session.
  - Query MongoDB to verify `user.id === conversation.customerId || user.id === conversation.providerId`.
  - If unauthorized, invoke callback with `{ status: 'error', message: 'Unauthorized room access' }` and do NOT join room.
  - If authorized, execute `socket.join("conversation:" + conversationId)`.
- Handling `message:send`:
  - Validate non-empty content (max 2000 chars).
  - Verify caller is currently joined in `conversation:<id>`.
  - Persist message in MongoDB via `ChatService.saveMessage`.
  - Broadcast `message:new` to `conversation:<id>` across all backend instances via Redis Adapter.

## Scope (Out)
- Voice/video media signaling (`Out of scope`).

## Tech / files to touch
- `apps/backend/src/modules/socket/chat.gateway.ts`
- `apps/backend/src/modules/chat/chat.service.ts`
- `apps/frontend/src/context/socket-context.tsx`
- `apps/frontend/src/components/chat/chat-window.tsx`

## Event delivery & failure contract
- **Delivery Guarantee**: At-least-once across connected clients in the room.
- **Idempotency Mechanism**: Message deduplication on client by `message.id`.
- **Failure Behavior**: If DB persistence fails, message is NOT broadcast, and caller callback receives `{ status: 'error' }`.

## Tests to write FIRST
1. `SERVER AUTH TEST: should reject conversation:join when user is neither customer nor provider of conversation`
2. `should allow authorized customer and provider to join conversation room`
3. `should reject message:send from socket not authorized in conversation`
4. `should persist message to MongoDB before broadcasting message:new`
5. `should broadcast message:new across two NestJS instances via Redis adapter`

## Implementation steps
1. In `ChatGateway`, implement `@SubscribeMessage('conversation:join')`: fetch conversation, verify participant membership, call `client.join()`.
2. Implement `@SubscribeMessage('message:send')`: validate content, call `chatService.saveMessage`, and emit `message:new` to `conversation:<id>`.
3. In frontend `ChatWindow`, emit `conversation:join` upon opening chat; listen for `message:new`.
4. Connect frontend message send button to `message:send` socket event.

## Acceptance criteria
- [ ] User attempting to join arbitrary conversation ID is rejected with error.
- [ ] Customer sends message; Provider connected on a different NestJS instance receives `message:new` instantly.
- [ ] Refreshing browser displays sent message in historical message log (confirming MongoDB persistence).

## Definition of Done
- [ ] Room authorization and multi-instance chat integration tests pass 100%.
- [ ] Test report generated in `feature-test-reports/FEAT-005-test-report.md`.

## Edge cases to handle
- Client sends message while disconnected: queue in local state or show failure alert.

## Pre-flight check
Confirm `FEAT-005-BE-chat.md` is verified.

## What's next
- `FEAT-005-VERIFY-chat.md`.

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
