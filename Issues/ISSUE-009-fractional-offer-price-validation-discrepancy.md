# ISSUE-009: Discrepancy Between Offer Submission Modal and Backend Minimum Price Threshold

## Summary
In `SubmitOfferDialog`, client-side validation accepts any positive price value greater than $0.00 (`parsedPrice <= 0`), allowing fractional values such as `$0.50`. However, backend `CreateOfferDto` enforces `@Min(1)`, rejecting sub-dollar prices with an HTTP 400 Bad Request error.

## Location / Flow
- **Components:** `SubmitOfferDialog` (`apps/frontend/src/components/offers/submit-offer-dialog.tsx`, lines 79–81) vs. `CreateOfferDto` (`apps/backend/src/modules/offers/dto/create-offer.dto.ts`, lines 12–15)
- **Route:** `POST /api/requests/:id/offers`
- **Role:** `provider`
- **Page:** `/requests/[id]`

## Steps to Reproduce
1. Log in as a Provider.
2. Navigate to an open request detail page at `/requests/<id>`.
3. Click "Submit Offer" to open `SubmitOfferDialog`.
4. Enter `0.50` into the Price input field.
5. Enter a valid proposal message: `"I can complete this minor repair quickly."`
6. Client-side validation passes without error.
7. Click "Submit Offer".
8. The backend API rejects the request with HTTP `400 Bad Request`:
   ```json
   {
     "statusCode": 400,
     "message": "Validation failed",
     "errors": ["Price must be at least 1"]
   }
   ```
9. The modal displays a server error alert after client validation indicated the input was valid.

## Expected Behavior
The client modal validation and backend DTO constraints must be aligned:
- If marketplace offers require a minimum price of $1.00 USD, `SubmitOfferDialog` should check `parsedPrice < 1` and display `'Please enter a valid price of at least $1.00'`.
- The input element should also specify `min="1.00"` to prevent user confusion.

## Actual Behavior
The client form allows entering `$0.50` and attempts the network mutation, only for the backend to reject it with HTTP 400.

## Severity
**Low** — Sub-dollar bids are edge cases in a service marketplace, but the discrepancy causes unexpected error states and UX friction.

## Category
Forms / Validation Consistency

## Scope
- **In Scope:**
  - Update `SubmitOfferDialog` validation to enforce `parsedPrice < 1` with `'Please enter a valid price of at least $1.00'`.
  - Add `min="1.00"` and appropriate helper text to the price input element.
  - Update frontend component tests in `apps/frontend/src/tests/offers.spec.tsx` to assert rejection of sub-dollar offers before calling the API.
- **Out of Scope:** Schema changes.

## Acceptance Criteria
- [x] `SubmitOfferDialog` rejects prices under $1.00 client-side before sending an API request.
- [x] Error message clearly instructs: "Please enter a valid price of at least $1.00".
- [x] All frontend component tests pass 100%.

## Related Feature/Ticket ID
`FEAT-003-BE`, `FEAT-003-FE`

## Status
**Verified Fixed** (2026-09-26)

## Resolution Details
1. **SubmitOfferDialog Validation (`apps/frontend/src/components/offers/submit-offer-dialog.tsx`):**
   - Updated client-side validation logic: `if (!price || isNaN(parsedPrice) || parsedPrice < 1)` setting error message to `'Please enter a valid price of at least $1.00'`.
   - Updated price `<input>` element with `min="1.00"`.
2. **Component Tests (`apps/frontend/src/tests/offers.spec.tsx`):**
   - Updated test #2 to assert rejection of empty, negative, and fractional sub-dollar values (`0.50`), ensuring API call is aborted with the new `$1.00` error message.
3. **Verification:**
   - 73/73 frontend UI tests pass.
   - Frontend TypeScript typechecking passed with 0 errors.

## Notes
Direct parallel to `ISSUE-006` (which resolved the budget threshold discrepancy in `CreateRequestForm`).
