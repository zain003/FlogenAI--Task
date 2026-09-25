# FEAT-005-FE — Real-Time Chat Interface (P0)

**Layer**: Frontend  
**Goal**: Build a clean real-time chat UI in Next.js 16 for Customers and Providers to communicate on accepted requests.

## Depends on
`FEAT-005-BE-chat.md`, `context/ui-context.md`

## Context pack
```typescript
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
GET /api/conversations/by-request/:requestId => Promise<ConversationEntity>
GET /api/conversations/:id/messages          => Promise<PaginatedResponse<MessageEntity>>
```

## Scope (In)
- Chat view / drawer accessible from accepted request page (`/chat/[requestId]`).
- Message history stream with distinct styling for own messages vs. counterparty messages.
- Input box with "Send" button and Enter key submit trigger.
- Auto-scroll to latest message on incoming new message.
- Connection indicator (green dot when active).

## Scope (Out)
- File uploads or emoji pickers (`Out of scope`).
- Read receipts / typing indicators (`Out of scope`).

## Tech / files to touch
- `apps/frontend/src/app/chat/[requestId]/page.tsx`
- `apps/frontend/src/components/chat/chat-window.tsx`
- `apps/frontend/src/components/chat/message-bubble.tsx`
- `apps/frontend/src/components/chat/chat-input.tsx`

## Nonfunctional requirements
- Usability: Enter key sends message; Shift+Enter creates newline.
- Empty state: display "No messages yet. Say hello to start the conversation."
- Contrast: Counterparty bubble in `--bg-surface`, own bubble in `--accent-primary`.

## Tests to write FIRST
1. `should render chat window with message history and input box`
2. `should display own messages aligned to right and counterparty messages to left`
3. `should clear input field after sending a message`
4. `should prevent sending empty or whitespace-only messages`
5. `should auto-scroll to bottom when new message arrives`

## Implementation steps
1. Build `MessageBubble` component with sender distinction and formatted timestamp.
2. Build `ChatInput` with controlled state, Enter listener, and disabled send button when input is empty.
3. Build `ChatWindow` fetching initial messages and rendering scrollable list.
4. Hook into SocketContext for real-time dispatch and receipt.

## Acceptance criteria
- [ ] Chat window displays historical messages loaded from backend.
- [ ] Typing message and pressing Enter emits message and adds bubble to chat stream.
- [ ] Own messages are styled distinctly from counterparty messages.

## Definition of Done
- [ ] Vitest fake DOM tests pass 100%.
- [ ] Clean typecheck and linting.

## Edge cases to handle
- Very long messages without spaces wrap cleanly (`break-words`).
- Rapid typing handles out-of-order local rendering gracefully.

## Pre-flight check
Confirm `FEAT-005-BE-chat.md` is verified.

## What's next
- `FEAT-005-INT-chat-realtime.md` and `FEAT-005-VERIFY-chat.md`.

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
