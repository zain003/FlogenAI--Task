# FEAT-002-FE — Service Requests UI & Feeds (P0)

**Layer**: Frontend  
**Goal**: Build the Customer Request Creation form, Customer Requests Dashboard, and Provider Marketplace feed in Next.js 16.

## Depends on
`FEAT-002-BE-requests.md`, `FEAT-001-FE-auth.md`, `context/ui-context.md`

## Context pack
```typescript
export interface ServiceRequestEntity {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: RequestStatus;
  customerId: string;
  createdAt: string;
}

export interface CreateRequestDto {
  title: string;
  description: string;
  budget: number;
}
```

## Consumes
```typescript
POST /api/requests              (body: CreateRequestDto) => Promise<ServiceRequestEntity>
GET  /api/requests              (query: { page?: number; limit?: number }) => Promise<PaginatedResponse<ServiceRequestEntity>>
GET  /api/requests/my-requests  () => Promise<PaginatedResponse<ServiceRequestEntity>>
GET  /api/requests/:id          (param: id) => Promise<ServiceRequestEntity>
```

## Scope (In)
- Customer dashboard (`/customer/requests`): form to create request and table/cards of submitted requests with status badges.
- Provider marketplace (`/provider/browse`): list of open service requests with budget, description, and "View / Make Offer" button.
- Request detail view (`/requests/[id]`): summary of request with placeholder for incoming offers.

## Scope (Out)
- Live WebSocket updates (`FEAT-002-INT`).
- Offer submission modal (`FEAT-003-FE`).

## Tech / files to touch
- `apps/frontend/src/app/customer/requests/page.tsx`
- `apps/frontend/src/app/provider/browse/page.tsx`
- `apps/frontend/src/app/requests/[id]/page.tsx`
- `apps/frontend/src/components/requests/create-request-form.tsx`
- `apps/frontend/src/components/requests/request-card.tsx`

## Nonfunctional requirements
- Status badges color-coded: `OPEN` in `--state-success`, `ACCEPTED` in `--state-warning`, `PAID` in `--state-success`.
- Empty state: display clear "No service requests found" card when list is empty.
- Responsive layout: single column on mobile, dual pane on desktop.

## Tests to write FIRST
1. `should render create request form with title, description, budget inputs`
2. `should validate budget is a positive number before submitting`
3. `should render list of open requests with title and budget formatted as USD`
4. `should display empty state message when no requests exist`
5. `should navigate to request detail page upon clicking request card`

## Implementation steps
1. Implement `CreateRequestForm` with input validation and clear button states.
2. Build `RequestCard` displaying title, budget (`$XX.XX`), status badge, and relative date.
3. Build Customer Dashboard page fetching and rendering `/api/requests/my-requests`.
4. Build Provider Browse page fetching and rendering open requests from `/api/requests?status=OPEN`.
5. Build Request Detail page displaying full description and metadata.

## Acceptance criteria
- [ ] Submitting valid request form calls `POST /api/requests` and immediately appends new request to customer list.
- [ ] Provider browse page displays all open requests with formatted budget.
- [ ] Clicking a request navigates to `/requests/[id]`.

## Definition of Done
- [ ] Vitest component tests pass 100%.
- [ ] Clean typecheck and linting.

## Edge cases to handle
- Budget formatting handles decimals cleanly (`$150.00`).
- Long descriptions are clamped in card view with ellipsis.

## Pre-flight check
Confirm `FEAT-002-BE-requests.md` is verified.

## What's next
- `FEAT-002-INT-requests-realtime.md` and `FEAT-002-VERIFY-requests.md`.

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
