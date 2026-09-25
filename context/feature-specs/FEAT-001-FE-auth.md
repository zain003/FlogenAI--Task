# FEAT-001-FE — Authentication UI & Session Handling (P0)

**Layer**: Frontend  
**Goal**: Build clean Next.js login and registration forms for Customers and Providers, handling JWT storage and redirect logic.

## Depends on
`FEAT-001-BE-auth.md`, `context/ui-context.md`

## Context pack
```typescript
export type UserRole = 'customer' | 'provider';

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
```typescript
POST /api/auth/register (body: RegisterDto) => Promise<AuthResponseDto>
POST /api/auth/login    (body: LoginDto)    => Promise<AuthResponseDto>
GET  /api/auth/me       (headers: { Authorization: "Bearer <token>" }) => Promise<UserEntity>
```

## Scope (In)
- Registration page (`/register`) with role toggle (`Customer` vs `Provider`).
- Login page (`/login`) with error feedback.
- Client `AuthContext` storing token in `localStorage` and memory.
- Navigation bar updating dynamically based on auth state and role.

## Scope (Out)
- Password recovery screens (`Out of scope`).
- Profile picture uploads (`Out of scope`).

## Tech / files to touch
- `apps/frontend/src/app/login/page.tsx`
- `apps/frontend/src/app/register/page.tsx`
- `apps/frontend/src/context/auth-context.tsx`
- `apps/frontend/src/components/navigation-bar.tsx`
- `apps/frontend/src/lib/api-client.ts`

## Nonfunctional requirements
- WCAG AA: Form inputs labeled, focus states visible (`--border-focus`).
- Submitting state: submit buttons disabled with spinner while awaiting response.
- Clear error alerts: HTTP 401/409 displayed in prominent banner (`--state-error`).

## Tests to write FIRST
1. `should render login form with email, password fields and submit button`
2. `should disable submit button and show loading indicator during submission`
3. `should display error alert banner when API responds with 401`
4. `should switch form role between customer and provider on register page`
5. `should store JWT in localStorage and redirect upon successful authentication`

## Implementation steps
1. Build `api-client.ts` Axios/Fetch wrapper injecting `Authorization: Bearer <token>`.
2. Implement `AuthContext` providing `user`, `token`, `login()`, `logout()`, `register()`.
3. Create `RegisterForm` component with Name, Email, Password, and Role selection.
4. Create `LoginForm` component with Email, Password, and validation messages.
5. Create `NavigationBar` displaying role badge and Logout action when authenticated.

## Acceptance criteria
- [ ] Submitting valid credentials stores JWT and redirects Customer to `/customer/requests` or Provider to `/provider/browse`.
- [ ] Submitting incorrect password displays error banner without page reload.
- [ ] Registration allows selecting either "Customer" or "Provider" role.
- [ ] Logging out clears JWT from storage and redirects to `/login`.

## Definition of Done
- [ ] Component fake DOM tests in Vitest pass 100%.
- [ ] No browser console errors during login/register flow.
- [ ] Clean typecheck and linting.

## Edge cases to handle
- Expired or malformed token in localStorage (clear storage and reset to logged-out state).
- Submitting empty fields triggers client-side validation before network call.

## Pre-flight check
Confirm `FEAT-001-BE-auth.md` is implemented and verified.

## What's next
- `FEAT-001-VERIFY-auth.md`.

## Ambiguity Resolution Protocol
If you encounter a case not covered by this spec:
1. Do NOT silently guess.
2. Make the smallest reasonable assumption needed to proceed.
3. Log it in specs/DEVIATIONS.md as: [FILE-ID] — [what was ambiguous] — [assumption made]
4. Continue implementation; do not block on it unless it affects the data model defined in 000-shared-contracts.md or a rule in 000-nonfunctional-contracts.md / 000-infra-contracts.md, in which case STOP and flag for human review.
