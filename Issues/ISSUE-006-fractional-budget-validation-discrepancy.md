# ISSUE-006: Discrepancy Between Frontend and Backend Minimum Budget Threshold

## Summary
`CreateRequestForm` accepts budgets with step `0.01` and client validation accepts any positive value > $0.00 (e.g. $0.50), but backend `CreateRequestDto` enforces `@Min(1)`, rejecting fractional values below $1.00 with HTTP 400.

## Location / Flow
- **Components:** `CreateRequestForm` (`apps/frontend/src/components/requests/create-request-form.tsx`) vs. `CreateRequestDto` (`apps/backend/src/modules/requests/dto/create-request.dto.ts`)
- **Route:** `POST /api/requests`
- **Role:** `customer`

## Steps to Reproduce
1. Log in as a Customer.
2. Navigate to `/customer/requests`.
3. Fill out the request creation form:
   - Title: "Consultation Call"
   - Description: "Brief 5-minute question on pipe repair."
   - Budget: `0.75`
4. Client validation passes without error.
5. Click "Publish Request".
6. The backend API responds with HTTP `400 Bad Request`:
   ```json
   {
     "statusCode": 400,
     "message": "Validation failed",
     "errors": ["budget must be greater than 0"]
   }
   ```
7. Note the discrepancy: the error message says "budget must be greater than 0", but $0.75 IS greater than 0. The actual validator is `@Min(1)`.

## Expected Behavior
The client form and backend DTO should enforce consistent minimum constraints:
- If the business rule requires a minimum of $1.00 USD, both the client form and backend error message should state "Budget must be at least $1.00".
- If sub-dollar budgets are intended to be supported, the backend validator should use `@IsPositive()` instead of `@Min(1)`.

## Actual Behavior
Client allows `0.75`; backend rejects with an error message claiming it must be greater than 0, confusing the user who entered a valid positive number.

## Severity
**Low** — Edge case for values between $0.01 and $0.99 that does not break standard service request budgets.

## Category
Forms / Validation Consistency

## Scope
- **In Scope:** Align client-side validation threshold (`min="1"`, error: "Budget must be at least $1.00") and update backend `@Min(1)` error message to "budget must be at least 1".
- **Out of Scope:** Schema currency representation.

## Acceptance Criteria
- [ ] Client form disallows entering values less than $1.00 before submission.
- [ ] Backend error message accurately specifies that budget must be at least $1.00.

## Related Feature/Ticket ID
`FEAT-002-BE`, `FEAT-002-FE`

## Status
Open

## Notes
Identified during form boundary input analysis ($0.01 to $0.99 range).
