# ISSUE-003: Missing Strict Rate Limiting Throttle on User Registration Endpoint

## Summary
`POST /api/auth/register` lacks the `@Throttle` decorator, falling back to the 60 requests/minute global ceiling instead of the mandatory 10 requests/minute limit mandated in the nonfunctional security contract.

## Location / Flow
- **URL/Endpoint:** `POST /api/auth/register`
- **Component / Service:** `apps/backend/src/modules/auth/auth.controller.ts` (`AuthController.register`)
- **Role:** `guest` / Unauthenticated

## Steps to Reproduce
1. Inspect `apps/backend/src/modules/auth/auth.controller.ts` line 25:
   ```typescript
   @Post('register')
   @HttpCode(HttpStatus.CREATED)
   async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
     return this.authService.register(registerDto);
   }
   ```
2. Note that `POST /api/auth/login` (line 33) is explicitly decorated with:
   ```typescript
   @Throttle({ default: { limit: 10, ttl: 60000 } })
   ```
3. Send 15 consecutive user registration requests from the same IP within 15 seconds.
4. Requests 11 through 15 are accepted and processed rather than returning HTTP 429.

## Expected Behavior
According to `context/feature-specs/000-nonfunctional-contracts.md` Section 1:
> "Sensitive endpoints (`POST /auth/login`, `POST /auth/register`) must enforce rate limits (maximum 10 requests per minute per IP via Redis sliding window)."

The 11th registration attempt within 60 seconds should return HTTP `429 Too Many Requests`.

## Actual Behavior
`POST /api/auth/register` inherits the permissive default global rate limit (60 requests/minute), allowing automated bots to rapidly create up to 60 accounts per minute before being blocked.

## Severity
**Medium** — Security & rate-limiting disparity that does not block core flows but increases vulnerability to automated spam registrations and database bloat.

## Category
Security / Rate Limiting

## Scope
- **In Scope:** Add `@Throttle({ default: { limit: 10, ttl: 60000 } })` to the `register` route in `AuthController`.
- **Out of Scope:** Global throttler configuration.

## Acceptance Criteria
- [x] Attempting more than 10 registration calls in a 60-second window returns HTTP `429 Too Many Requests`.
- [x] Response headers include rate limit remaining / retry-after details.

## Related Feature/Ticket ID
`FEAT-001-BE`, `000-nonfunctional-contracts.md`

## Status
Verified Fixed

## Notes
- Resolution: Decorated `POST /api/auth/register` with `@Throttle({ default: { limit: 10, ttl: 60000 } })` in `AuthController`, enforcing the 10 req/minute per IP rate limit specified in `000-nonfunctional-contracts.md`.
- Verified with unit and API tests in `auth.controller.spec.ts` passing 100%.
