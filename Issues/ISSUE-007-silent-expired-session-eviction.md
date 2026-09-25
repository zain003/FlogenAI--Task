# ISSUE-007: Silent Session Eviction Without User Notification on Expired JWT

## Summary
When an expired or invalid JWT token is stored in `localStorage`, `AuthProvider.initializeAuth()` silently purges the token upon failed profile retrieval without notifying the user that their session expired, leading to unexpected logged-out state.

## Location / Flow
- **File:** `apps/frontend/src/context/auth-context.tsx` (`initializeAuth`)
- **Flow:** App initialization on page refresh with stale session
- **Role:** All authenticated roles

## Steps to Reproduce
1. In the browser console, set an expired or corrupted token:
   ```javascript
   localStorage.setItem('flogen_token', 'expired.jwt.token');
   ```
2. Refresh the browser page on any route (e.g., `/customer/requests`).
3. In `apps/frontend/src/context/auth-context.tsx` lines 83-90:
   ```typescript
   try {
     ...
     const profile = await apiClient.auth.getMe(storedToken);
   } catch {
     apiClient.setToken(null);
     if (isMounted) {
       setUser(null);
       setTokenState(null);
     }
   }
   ```
4. The token is deleted and state is set to `user: null`.
5. The UI transitions to the logged-out state with zero toast or alert feedback explaining why the session terminated.

## Expected Behavior
When an existing session token fails authentication on startup due to expiration (HTTP 401), the app should display a non-intrusive alert (e.g., "Your session has expired. Please sign in again.") or redirect to `/login?reason=expired` so the user understands the state transition.

## Actual Behavior
The session is silently discarded with zero user feedback.

## Severity
**Low** — Usability and session feedback polish. Does not cause data corruption or block re-authentication.

## Category
Auth / Usability

## Scope
- **In Scope:** Provide user feedback or a query parameter when an expired token is cleared during `initializeAuth()`.
- **Out of Scope:** JWT expiration duration settings in backend.

## Acceptance Criteria
- [ ] User receives clear feedback when an expired session token is evicted on app initialization.

## Related Feature/Ticket ID
`FEAT-001-FE`

## Status
Open

## Notes
Observed during session lifecycle and invalidation edge-case testing.
