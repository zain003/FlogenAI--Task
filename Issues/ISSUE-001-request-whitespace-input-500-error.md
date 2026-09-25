# ISSUE-001: Whitespace-Only Request Title or Description Triggers HTTP 500 Error

## Summary
Submitting a service request with whitespace-only `title` or `description` passes client/DTO validation, but service-level trimming transforms it into an empty string, causing Mongoose schema validation failure and an unhandled HTTP 500 Internal Server Error instead of a 400 Bad Request.

## Location / Flow
- **URL/Endpoint:** `POST /api/requests`
- **Component / Service:** `RequestsController` -> `RequestsService.create` -> `ServiceRequest` Mongoose Model
- **Role:** `customer`

## Steps to Reproduce
1. Authenticate as a Customer (`role: customer`) and acquire a valid Bearer JWT.
2. Send an HTTP `POST` request to `http://localhost:8080/api/requests` with payload:
   ```json
   {
     "title": "   ",
     "description": "Valid description with over ten characters.",
     "budget": 100
   }
   ```
3. Observe the response status code and body.

## Expected Behavior
The request payload should be validated before reaching persistence. Because the title consists entirely of whitespace characters, the backend should return HTTP `400 Bad Request` with an actionable error message such as:
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["title should not be empty after trimming"]
}
```

## Actual Behavior
The backend server crashes with HTTP `500 Internal Server Error`:
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "timestamp": "2026-09-25T21:00:15.403Z",
  "path": "/api/requests"
}
```

## Root Cause
In `apps/backend/src/modules/requests/dto/create-request.dto.ts`, `title` is validated only via `@IsString()`, `@MinLength(3)`, and `@MaxLength(100)`. Because `"   ".length === 3`, class-validator allows the DTO to pass. Then in `RequestsService.create`:
```typescript
const createdRequest = new this.requestModel({
  title: createRequestDto.title.trim(), // evaluates to ""
  ...
});
```
In `ServiceRequestSchema`, `title` has `required: true, trim: true`. Mongoose rejects the empty string with a Mongoose `ValidationError` (`Path 'title' is required.`). Because this exception is not an instance of `HttpException`, NestJS's `HttpExceptionFilter` falls back to HTTP 500 Internal Server Error. The exact same vulnerability applies to `description` when given `"          "` (10 spaces).

## Severity
**High** — Degrades the core service request creation flow and yields unhandled 500 server crashes instead of proper 400 client-side validation errors.

## Category
Forms / Error Handling

## Scope
- **In Scope:** 
  - Add `@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)` or `@Matches(/\S+/)` / non-whitespace validation in `CreateRequestDto`.
  - Handle Mongoose `ValidationError` gracefully in `HttpExceptionFilter` to map persistence validation failures to HTTP 400.
- **Out of Scope:** Other DTOs (covered by ISSUE-002).

## Acceptance Criteria
- [x] Submitting a whitespace-only title (e.g., `"   "`) returns HTTP `400 Bad Request`.
- [x] Submitting a whitespace-only description (e.g., `"          "`) returns HTTP `400 Bad Request`.
- [x] Zero HTTP 500 exceptions occur when whitespace payloads are submitted.

## Related Feature/Ticket ID
`FEAT-002-BE`

## Status
Verified Fixed

## Notes
- Resolution: Added `@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)` in `CreateRequestDto` to trim `title` and `description` before `@MinLength` validation.
- Defense in Depth: Enhanced `HttpExceptionFilter` to map Mongoose `ValidationError` instances to `HttpStatus.BAD_REQUEST (400)` with structured field error lists.
- Verified with unit tests in `requests.controller.spec.ts` passing 100%.
