# FEAT-001-BE — User Authentication & Role Authorization (P0)

**Layer**: Backend  
**Goal**: Provide secure registration, login, bcrypt password hashing, JWT token generation, and role-based guards for Customers and Providers.

## Depends on
`000-shared-contracts.md`, `000-nonfunctional-contracts.md`

## Context pack
```typescript
export type UserRole = 'customer' | 'provider';

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
}
```

## Consumes
None (initial foundation module).

## Provides / Exposes
```typescript
// REST Endpoints
POST /api/auth/register (body: RegisterDto) => Promise<AuthResponseDto>
POST /api/auth/login    (body: LoginDto)    => Promise<AuthResponseDto>
GET  /api/auth/me       (headers: { Authorization: "Bearer <token>" }) => Promise<UserEntity>

// Guards & Decorators
export class JwtAuthGuard implements CanActivate {}
export class RolesGuard implements CanActivate {}
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
export const CurrentUser = createParamDecorator(...);
```

## Scope (In)
- User Mongoose schema with unique email constraint.
- Password hashing using `bcrypt` (10 rounds).
- JWT issuance containing `{ sub: user.id, email: user.email, role: user.role }`.
- `JwtAuthGuard` and `RolesGuard` for securing downstream routes.
- Input validation via `class-validator`.

## Scope (Out)
- Password reset via email (`Out of scope for assessment`).
- OAuth / third-party identity providers (`Out of scope`).
- Frontend forms (`FEAT-001-FE`).

## Tech / files to touch
- `apps/backend/src/modules/auth/auth.controller.ts`
- `apps/backend/src/modules/auth/auth.service.ts`
- `apps/backend/src/modules/auth/dto/register.dto.ts`
- `apps/backend/src/modules/auth/dto/login.dto.ts`
- `apps/backend/src/modules/auth/guards/jwt-auth.guard.ts`
- `apps/backend/src/modules/auth/guards/roles.guard.ts`
- `apps/backend/src/modules/auth/schemas/user.schema.ts`

## Nonfunctional requirements
- Rate limiting: max 10 requests per minute on `/api/auth/login` per IP.
- Input validation: reject invalid email format or passwords < 8 characters with HTTP 400.
- Password hashing cost: bcrypt salt rounds >= 10.

## Tests to write FIRST
1. `should register a new customer and return JWT with HTTP 201`
2. `should reject registration with duplicate email with HTTP 409 Conflict`
3. `should reject registration with invalid email or weak password with HTTP 400`
4. `should authenticate valid credentials and return signed JWT with HTTP 200`
5. `should reject login with wrong password with HTTP 401 Unauthorized`
6. `should allow access to protected route when valid JWT is supplied`
7. `should reject access with HTTP 403 when user role does not match required @Roles()`

## Implementation steps
1. Define Mongoose `UserSchema` with `email` (unique index), `passwordHash`, `name`, `role`, and timestamps.
2. Create `RegisterDto` and `LoginDto` with `class-validator` rules (`@IsEmail()`, `@MinLength(8)`, `@IsEnum(['customer', 'provider'])`).
3. Implement `AuthService.register`: hash password, check email uniqueness, persist user, sign JWT.
4. Implement `AuthService.login`: find user, verify bcrypt hash, sign JWT.
5. Implement `JwtStrategy`, `JwtAuthGuard`, and `RolesGuard` evaluating metadata against `user.role`.
6. Bind endpoints in `AuthController` and expose global `ValidationPipe`.

## Acceptance criteria
- [ ] `POST /api/auth/register` with valid customer details returns HTTP 201, user record without `passwordHash`, and signed JWT.
- [ ] Duplicate email registration returns HTTP 409 Conflict.
- [ ] `POST /api/auth/login` with correct password returns HTTP 200 and signed JWT.
- [ ] `POST /api/auth/login` with incorrect password returns HTTP 401 Unauthorized.
- [ ] `GET /api/auth/me` without Authorization header returns HTTP 401.
- [ ] Route protected by `@Roles('customer')` returns HTTP 403 when accessed by user with role `'provider'`.

## Definition of Done
- [ ] Unit and API tests pass 100% with zero skipped tests.
- [ ] Clean typecheck (`tsc --noEmit`) and linting.
- [ ] Test report generated using `feature-test-reports/template-test-report.md` into `feature-test-reports/FEAT-001-test-report.md`.
- [ ] `DEVIATIONS.md` updated if any assumption was made.

## Edge cases to handle
- Whitespace in email address (must be trimmed and normalized to lowercase).
- Missing request body returns structured HTTP 400 with array of validation messages.

## Pre-flight check
Confirm `000-shared-contracts.md` and `000-nonfunctional-contracts.md` are present.

## What's next
- `FEAT-001-FE-auth.md` (Authentication UI in Next.js).
- `FEAT-001-VERIFY-auth.md` (Formal verification pass).

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
