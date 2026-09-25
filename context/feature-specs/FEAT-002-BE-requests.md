# FEAT-002-BE — Service Requests Management & CRUD (P0)

**Layer**: Backend  
**Goal**: Implement service request creation, retrieval, status management, and paginated listing for Customers and Providers.

## Depends on
`FEAT-001-VERIFY-auth.md`, `000-shared-contracts.md`

## Context pack
```typescript
export type RequestStatus = 'OPEN' | 'ACCEPTED' | 'PAID' | 'COMPLETED' | 'CANCELLED';

export interface ServiceRequestEntity {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: RequestStatus;
  customerId: string;
  acceptedOfferId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequestDto {
  title: string;
  description: string;
  budget: number;
}
```

## Consumes
```typescript
export class JwtAuthGuard implements CanActivate {}
export class RolesGuard implements CanActivate {}
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
export const CurrentUser = createParamDecorator(...);
```

## Provides / Exposes
```typescript
POST /api/requests              (body: CreateRequestDto, auth: Customer) => Promise<ServiceRequestEntity>
GET  /api/requests              (query: { page?: number; limit?: number; status?: RequestStatus }) => Promise<PaginatedResponse<ServiceRequestEntity>>
GET  /api/requests/my-requests  (auth: Customer, query: { page?: number; limit?: number }) => Promise<PaginatedResponse<ServiceRequestEntity>>
GET  /api/requests/:id          (param: id) => Promise<ServiceRequestEntity>
```

## Scope (In)
- Mongoose schema `service_requests` with compound index on `(status, customerId)`.
- Customer-only creation of requests (`@Roles('customer')`).
- Input validation via `CreateRequestDto` (`title`: 3-100 chars, `description`: 10-2000 chars, `budget`: positive number).
- Paginated listing with mandatory limit (default 20, max 50).
- Customer query for personal requests and public query for open requests.

## Scope (Out)
- Real-time WebSocket broadcasting (`FEAT-002-INT`).
- Offer creation against requests (`FEAT-003-BE`).
- Request update/delete screens (`Out of assessment scope`).

## Tech / files to touch
- `apps/backend/src/modules/requests/requests.controller.ts`
- `apps/backend/src/modules/requests/requests.service.ts`
- `apps/backend/src/modules/requests/dto/create-request.dto.ts`
- `apps/backend/src/modules/requests/schemas/service-request.schema.ts`

## Nonfunctional requirements
- Database pagination: never return unbounded arrays; cap limit at 50.
- P95 query response latency: `< 150ms`.
- Strict customer ownership validation when querying private requests.

## Tests to write FIRST
1. `should allow authenticated customer to create request with HTTP 201`
2. `should reject request creation by provider with HTTP 403 Forbidden`
3. `should reject request creation with negative budget or empty title with HTTP 400`
4. `should list open requests with pagination metadata`
5. `should enforce maximum limit of 50 on request list queries`
6. `should return 404 Not Found when querying non-existent request ID`

## Implementation steps
1. Define Mongoose `ServiceRequestSchema` with indexed `status` and `customerId`.
2. Define `CreateRequestDto` with `@IsString()`, `@MinLength(3)`, `@IsNumber()`, `@Min(1)`.
3. Implement `RequestsService.create`: link `customerId` from JWT, set default status `OPEN`.
4. Implement `RequestsService.findAll`: support `status`, `page`, `limit` with `.skip().limit().lean()`.
5. Implement `RequestsService.findByCustomer`: query requests owned by caller ID.
6. Implement `RequestsController` with `@UseGuards(JwtAuthGuard, RolesGuard)`.

## Acceptance criteria
- [ ] `POST /api/requests` creates request with status `OPEN` and customer's ID.
- [ ] Provider role receives HTTP 403 when attempting to create a request.
- [ ] Malformed budget (`-10` or string) returns HTTP 400 with validation message.
- [ ] `GET /api/requests` returns paginated structure with total count and page indicators.
- [ ] `GET /api/requests/:id` returns 404 for unknown ID.

## Definition of Done
- [ ] Unit and API tests pass 100%.
- [ ] Clean typecheck and linting.
- [ ] Test report generated using `feature-test-reports/template-test-report.md`.

## Edge cases to handle
- Invalid MongoDB ObjectId format in `:id` route parameter returns HTTP 400 Bad Request instead of 500.

## Pre-flight check
Confirm `FEAT-001-VERIFY-auth.md` passed and is not stale.

## What's next
- `FEAT-002-FE-requests.md` and `FEAT-002-INT-requests-realtime.md`.

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
