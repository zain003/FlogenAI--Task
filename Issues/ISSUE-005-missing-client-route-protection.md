# ISSUE-005: Absence of Client-Side Route Protection and Role Redirect on Dashboard Routes

## Summary
Navigating directly to `/customer/requests` or `/provider/browse` as an unauthenticated visitor or an opposing role renders the full page layout and fires backend API queries that fail with 401/403, leaving the user on a half-loaded page with raw error banners rather than redirecting to `/login` or the appropriate workspace.

## Location / Flow
- **Pages:** `/customer/requests`, `/provider/browse`
- **Files:** `apps/frontend/src/app/customer/requests/page.tsx`, `apps/frontend/src/app/provider/browse/page.tsx`
- **Role:** `guest` (Unauthenticated), or Cross-Role mismatch (Provider on customer page / Customer on provider page)

## Steps to Reproduce
1. In a private browser window (unauthenticated), enter `http://localhost:3000/customer/requests` in the address bar.
2. Observe page loads: the "Create Service Request" form and "My Service Requests" container render immediately.
3. Because no token exists, `apiClient.requests.getMyRequests()` fails with HTTP 401 Unauthorized.
4. The page displays an error alert banner: `"No auth token"` or `"Failed to fetch your service requests"`, but does not redirect the user to `/login`.
5. Log in as a Provider (`role: provider`), then enter `http://localhost:3000/customer/requests`.
6. The backend rejects the query with HTTP 403 Forbidden (`"Forbidden resource"`).
7. The page shows an error alert banner, but leaves the customer request creation form active on screen. Attempting to submit the form fails with 403.

## Expected Behavior
- Unauthenticated users attempting to access `/customer/requests` or `/provider/browse` should be intercepted and redirected to `/login` (with a return redirect query if applicable).
- Users with the `provider` role accessing `/customer/requests` should be redirected to `/provider/browse`.
- Users with the `customer` role accessing `/provider/browse` should either view it in read-only mode or be redirected to `/customer/requests`.

## Actual Behavior
No client-side auth guards or redirection hooks exist in `CustomerRequestsPage` or `ProviderBrowsePage`. The pages mount and query the API regardless of auth state or role, relying on backend rejection to show an in-page error message while leaving form elements accessible.

## Severity
**Medium** — Degrades authentication flow and role boundary enforcement, producing confusing UX friction.

## Category
Auth / Navigation / Usability

## Scope
- **In Scope:** Add client-side route guard hook (or Next.js middleware / layout check) in `/customer/requests` and `/provider/browse` to redirect unauthenticated or mis-roled users.
- **Out of Scope:** Server-side backend guards (which already correctly return 401/403).

## Acceptance Criteria
- [ ] Direct unauthenticated visit to `/customer/requests` redirects to `/login`.
- [ ] Direct unauthenticated visit to `/provider/browse` redirects to `/login`.
- [ ] Provider visiting `/customer/requests` is redirected to `/provider/browse`.

## Related Feature/Ticket ID
`FEAT-001-FE`, `FEAT-002-FE`

## Status
Open

## Notes
Observed during role-based boundary testing and unauthenticated direct navigation checks.
