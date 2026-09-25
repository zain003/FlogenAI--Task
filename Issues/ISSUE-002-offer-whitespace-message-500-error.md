# ISSUE-002: Whitespace-Only Offer Proposal Message Triggers HTTP 500 Error

## Summary
In `CreateOfferDto`, submitting a proposal message containing only whitespace characters (e.g., 5 spaces) satisfies `@MinLength(5)`, but service-level trimming transforms it into an empty string, triggering a Mongoose schema validation crash with HTTP 500.

## Location / Flow
- **URL/Endpoint:** `POST /api/requests/:id/offers`
- **Component / Service:** `OffersController` -> `OffersService.createOffer` -> `Offer` Mongoose Model
- **Role:** `provider`

## Steps to Reproduce
1. Authenticate as a Provider (`role: provider`).
2. Identify an open service request ID.
3. Send an HTTP `POST` request to `http://localhost:8080/api/requests/:id/offers` with payload:
   ```json
   {
     "price": 250,
     "message": "     "
   }
   ```
4. Observe the response status code and body.

## Expected Behavior
The backend should reject the proposal with HTTP `400 Bad Request` and an actionable validation message:
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["message cannot be empty or contain only whitespace"]
}
```

## Actual Behavior
The backend returns HTTP `500 Internal Server Error` due to unhandled Mongoose `ValidationError` on `OfferSchema` (`minlength: 5` and `required: true`).

## Root Cause
In `apps/backend/src/modules/offers/dto/create-offer.dto.ts`:
```typescript
@IsString({ message: 'Message must be a string' })
@MinLength(5, { message: 'Message must be at least 5 characters long' })
@MaxLength(1000, { message: 'Message cannot exceed 1000 characters' })
message!: string;
```
Because `"     ".length === 5`, the raw payload passes DTO validation. In `OffersService.createOffer`:
```typescript
const newOffer = new this.offerModel({
  requestId,
  providerId,
  price: createOfferDto.price,
  message: createOfferDto.message.trim(), // becomes "" (length 0)
  status: 'PENDING',
});
```
In `OfferSchema`, `message` has `trim: true, minlength: 5, required: true`. The empty string fails Mongoose validation, throwing an unhandled exception resulting in HTTP 500.

## Severity
**High** — Degrades the core offer submission workflow and causes unhandled 500 errors on invalid provider bids.

## Category
Forms / Error Handling

## Scope
- **In Scope:**
  - Add `@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)` and non-whitespace check to `CreateOfferDto`.
  - Ensure trimmed length is verified >= 5 before saving.
- **Out of Scope:** Request DTOs (covered by ISSUE-001).

## Acceptance Criteria
- [ ] Submitting whitespace-only message returns HTTP `400 Bad Request`.
- [ ] Error response contains clear feedback indicating message must contain at least 5 non-whitespace characters.
- [ ] Zero HTTP 500 errors occur on whitespace inputs.

## Related Feature/Ticket ID
`FEAT-003-BE`

## Status
Open

## Notes
Consolidated with ISSUE-001 under the input sanitization & Mongoose validation failure root cause pattern per Deduplication Rule.
