# ISSUE-004: Navigation Bar Hides Dashboard Links on Mobile Viewports Without Mobile Menu

## Summary
The top navigation bar hides core workspace links ("My Requests" and "Browse Marketplace") on mobile screen widths (< 640px) without providing a mobile hamburger toggle, drawer, or dropdown menu, preventing mobile users from navigating between sections.

## Location / Flow
- **Component:** `NavigationBar` (`apps/frontend/src/components/navigation-bar.tsx`)
- **Viewport:** Mobile viewports (< 640px, e.g., 375px mobile screen)
- **Role:** `customer`, `provider`

## Steps to Reproduce
1. Open the application in a mobile viewport (e.g., width 375px in browser DevTools).
2. Log in as a Customer or Provider.
3. Observe the top navigation header.
4. Note that "My Requests" (Customer) and "Browse Marketplace" (Provider) links are absent.
5. Search for a hamburger icon, mobile drawer, or dropdown: none exists.

## Expected Behavior
Per `QA-Testing-Final.md` Section 1 and `ui-context.md`, navigation should remain functional across standard mobile breakpoints (~375px). A responsive mobile menu (hamburger button that opens a drawer or dropdown) should allow mobile users to access their role-specific dashboard.

## Actual Behavior
In `apps/frontend/src/components/navigation-bar.tsx` line 36:
```tsx
{isAuthenticated && (
  <nav className="hidden items-center space-x-5 sm:flex">
    {user?.role === 'customer' && (
      <Link href="/customer/requests" ...>My Requests</Link>
    )}
    {user?.role === 'provider' && (
      <Link href="/provider/browse" ...>Browse Marketplace</Link>
    )}
  </nav>
)}
```
The links are completely hidden on mobile viewports (`hidden ... sm:flex`), and no mobile menu is provided. Users on mobile must either manipulate the browser URL manually or log out to return home.

## Severity
**Medium** — Degrades mobile usability and navigation flow, though desktop and tablet viewports function as intended.

## Category
Navigation / Usability / Responsive Design

## Scope
- **In Scope:** Implement a mobile menu button (hamburger toggle) and accessible mobile nav drawer/dropdown in `NavigationBar`.
- **Out of Scope:** Desktop header redesign.

## Acceptance Criteria
- [x] At viewports < 640px, a mobile navigation toggle button is rendered.
- [x] Clicking the toggle displays accessible links to "My Requests" (for Customer) or "Browse Marketplace" (for Provider).
- [x] Mobile menu can be closed with click-outside, Esc key, or close button.

## Related Feature/Ticket ID
`FEAT-001-FE`, `FEAT-002-FE`

## Status
Verified Fixed

## Resolution Details
- Added responsive mobile navigation toggle button (`data-testid="mobile-menu-toggle"`) with dynamic `Menu`/`X` state in `apps/frontend/src/components/navigation-bar.tsx`.
- Implemented dropdown/drawer menu (`data-testid="mobile-nav-menu"`) rendering role-specific navigation links (`mobile-nav-customer-requests` and `mobile-nav-provider-browse`) on viewports under 640px.
- Integrated keyboard `Escape` dismissal listener and click-outside handling.
- Automated unit and integration tests added to `apps/frontend/src/tests/navigation-bar.spec.tsx` verifying toggle opening, role-specific link rendering, and dismissal behaviors (all 6 navigation tests passing).

## Notes
Reported during the responsive navigation audit at the 375px breakpoint. Verified fixed with 100% test pass rate.
