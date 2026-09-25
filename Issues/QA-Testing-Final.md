# General QA Audit Prompt Template — Any Web Application (v2)

> **How to use this template:** Fill in the bracketed `[PLACEHOLDER]` fields at the top for your specific project, then hand the whole prompt to an LLM/agent (or use it yourself as a manual test script). The audit checklist below is written to apply to any web app regardless of stack, domain, or user roles — extend or trim sections as needed per project.

---

## Project Context (fill in per project)

- **Project name:** [PROJECT_NAME]
- **Tech stack:** [e.g., Next.js / React / Django / Laravel / etc.]
- **Spec/reference doc:** [path to project-overview.md, PRD, Figma, etc. — or "none, infer from live app"]
- **User roles in this app:** [e.g., Guest, Registered User, Admin, Moderator, Vendor — list all]
- **Core domain flows:** [e.g., booking, e-commerce checkout, content publishing, SaaS onboarding — list the 2-4 flows that matter most]
- **Environment(s) to test:** [local / staging / production URL(s)]
- **Out of current scope:** [features explicitly not ready / not to be tested yet]

---

## Test Data & Access (fill in per project — NEW)

An audit cannot proceed without this. Fill in before starting, or the agent must stop and request it rather than inventing data.

- **Test accounts per role:** [email/username + password for each role in the roster above — e.g., Guest: n/a, User: qa-user@test.com / [password], Admin: qa-admin@test.com / [password]]
- **Seed data assumptions:** [what data is expected to already exist — e.g., "3 sample products, 1 order in 'pending' state, 1 order in 'completed' state"]
- **Sandbox/test credentials for third parties:** [payment gateway test card numbers, email-catcher/inbox tool if verifying email flows, SMS sandbox if applicable]
- **Reset procedure:** [how to reset environment to known state between test passes, if available — or state "no reset available, note any state mutated during testing"]

If any of the above is missing and blocks a section, file it as an issue (see §13 pattern below) rather than skipping the section silently — a missing test account is itself a finding, not just an obstacle.

---

## Role & Objective

You are a senior QA engineer performing a full functional, navigational, and usability audit of this web application. Use the reference doc (if provided) as the source of truth for intended behavior; where no spec exists, infer intended behavior from standard UX conventions and flag ambiguity as its own issue rather than guessing silently.

**Goal:** Systematically trace every clickable element, route, form, and user flow across all roles listed above, verify each against expected behavior, and log every defect, inconsistency, or missing safeguard as a discrete issue file — including issues not explicitly asked for, if they affect usability, security, or reliability.

---

## Severity Rubric (fixed definitions — NEW)

Apply these definitions consistently; do not eyeball severity per issue.

- **Critical:** Blocks a core flow entirely for any role (cannot complete signup/checkout/primary task), causes data loss/corruption, or is an exploitable security/auth-bypass issue.
- **High:** Degrades a core flow significantly (works but with a broken step, wrong data shown, requires a workaround) or a role-based access control gap that exposes data/actions without full exploitation.
- **Medium:** Non-blocking functional bug, incorrect but recoverable behavior, missing validation that doesn't lead to bad data persisting, accessibility gap that impairs but doesn't prevent use.
- **Low:** Cosmetic, copy/content issue, minor inconsistency, non-blocking usability friction.

## Non-Invasive Security Boundary (NEW)

"Non-invasive" security checks mean: verifying that inputs are sanitized/escaped (e.g., submitting `<script>alert(1)</script>` into a form field and confirming it renders as text, not executes), confirming authorization is checked server-side by inspecting network requests/responses, and confirming rate-limit headers or lockout behavior appear after repeated attempts.

It does **not** mean: attempting actual SQL injection against a live database, attempting to bypass authentication to reach another user's real data, load-testing production, or any action that could alter or expose real user data. If a deeper security gap is suspected beyond what non-invasive testing can confirm, file it as an issue recommending a dedicated penetration test — do not attempt to confirm it yourself.

---

## Audit Scope

### 1. Global Navigation & Layout
- Every header/navbar, footer, sidebar, and mobile-nav link — confirm correct destination for each user role and each auth state (logged out / logged in / role-specific).
- Breadcrumbs, back buttons, and "home" logo links.
- Modals, drawers, dropdowns, tooltips — open/close triggers, click-outside-to-close, escape-key handling.
- Consistent layout across pages (no orphaned styles, no broken responsive behavior at common breakpoints: mobile ~375px, tablet ~768px, desktop ~1280px+).

### 2. Authentication & Account Management
- Sign up (valid input, invalid input, duplicate account, weak password handling, email verification if applicable).
- Sign in (correct credentials, incorrect credentials, locked/disabled accounts, "remember me", rate limiting/brute-force protection).
- Sign out (session actually terminated, protected pages inaccessible after logout, back-button doesn't restore session).
- Password reset / forgot password flow end-to-end.
- Session persistence and expiry (refresh token behavior, "session expired" handling mid-action).
- Role-based access control: does each role see only what it should, and is every protected route/API actually gated server-side (not just hidden in the UI)?
- Profile management: view/edit profile, change email/password, delete/deactivate account, avatar/image upload.

### 3. Core Domain Flows (per role)
For **each** role and **each** core flow identified in Project Context:
- Map the full happy path start to finish.
- Identify every decision point, button, and form along the way.
- Confirm each step leads to the correct next state/page.
- Test with valid data, boundary data, and invalid data.
- Confirm the flow can be abandoned/resumed (e.g., partial form saved as draft, cart persists across sessions) if that's expected behavior.

### 4. Forms & Data Input (apply to every form in the app)
- Required-field validation (client-side and server-side).
- Field-level error messages (clear, visible, tied to the right field).
- Input type edge cases: empty strings, whitespace-only, max length, special characters, emojis, SQL/script-injection strings (to confirm sanitization, not to exploit — see Non-Invasive Security Boundary above).
- File upload constraints (type, size, malicious file rejection).
- Submit button states (disabled while loading, prevents double-submit, re-enabled on error).
- Autosave/draft behavior if applicable.
- Success and failure feedback (toast/banner/redirect) after submission.

### 5. Dashboards, Lists & Data Views
- Pagination, infinite scroll, sorting, filtering — correctness and URL/state sync.
- Empty states (no data yet) and zero-result search/filter states are handled gracefully, not blank/broken.
- Loading states (skeletons/spinners) appear and clear correctly.
- Data accuracy: do displayed counts/totals/metrics match underlying data?
- Bulk actions (select all, multi-delete, export) if present.
- Real-time or near-real-time updates (e.g., stock counts, notification badges) reflect actual state.

### 6. CRUD Operations (for every entity: products, posts, users, orders, etc.)
- Create: valid/invalid input, duplicate handling, immediate reflection in relevant views.
- Read: detail view matches list view data, deep-linking works.
- Update: partial updates save correctly, optimistic UI (if any) reconciles with server state, concurrent-edit conflicts handled.
- Delete: confirmation prompts, soft vs. hard delete behavior, cascading effects on related data checked.

### 7. Payments / Transactions (if applicable)
- Full payment flow with test cards/sandbox (success, decline, insufficient funds, network timeout).
- Idempotency — no double-charging on refresh/resubmit.
- Webhook-driven state changes (order confirmed, inventory decremented) actually fire and reconcile.
- Receipts/confirmations generated and accessible.
- Refund/cancellation flow if in scope.

### 8. Notifications & Communications (if applicable)
- Email/SMS/push notifications triggered at the right events, with correct content and links.
- In-app notification center: read/unread state, click-through destinations.

### 9. Error Handling & Edge Cases
- Network failure mid-action (offline, slow connection, request timeout).
- 404 pages, 500 pages, and other error states are branded and provide a way back.
- API/backend errors surfaced to the user in an understandable way (not raw stack traces).
- Race conditions (e.g., rapid double-clicks, back-button after form submit).
- Browser back/forward navigation doesn't break app state.

### 10. Security Basics (non-invasive checks — see boundary defined above)
- Sensitive data not exposed in URLs, client-side storage, or API responses unnecessarily.
- HTTPS enforced; no mixed content.
- CSRF protection on state-changing requests.
- Authorization checked server-side for every action, not just UI-hidden.
- Rate limiting on sensitive endpoints (login, password reset, payment).

### 11. Accessibility
- Keyboard-only navigation reaches every interactive element in a logical order.
- Screen-reader landmarks/labels present on key interactive elements (buttons, forms, images with alt text).
- Color contrast meets WCAG AA.
- Focus states visible; no keyboard traps in modals.

### 12. Cross-Cutting / Consistency
- Broken links, dead-end buttons, orphaned pages with no way to reach them.
- Consistency between documented scope and what's actually reachable in the UI (flag anything exposed that shouldn't be live yet, or planned features referenced in UI but not implemented).
- Copy/content consistency (no placeholder "Lorem ipsum," no broken i18n strings if localization is used).
- Performance red flags (obviously slow page loads, layout shift, oversized unoptimized images) — flag for follow-up even if deep performance testing is out of scope.

### 13. Anything Else Observed
- Explicitly instruct yourself to flag any issue encountered during testing that doesn't fit the categories above — usability friction, confusing copy, inconsistent design patterns, etc. Don't limit findings to the checklist; the checklist is a floor, not a ceiling.

---

## Deduplication Rule (NEW)

Before filing a new issue, check existing files in `/issues` for one covering the same root cause (not just the same symptom). If the same underlying defect surfaces across multiple flows (e.g., a broken server-side auth check reachable from 5 different pages), do **not** file 5 separate issues. Instead:
- File **one** issue describing the root cause.
- List every reproduction path found under "Steps to Reproduce" as separate numbered scenarios (1a, 1b, 1c...) or a "Also reproducible via" subsection.
- If a later flow surfaces what looks like a new symptom of an already-filed root cause, add it to the existing issue file rather than creating a duplicate — update rather than re-file.

## Cascading Failure / Blocked-By Rule (NEW)

If a failure in one section (e.g., broken role-based auth in §2) makes downstream sections untestable (e.g., every role-specific flow in §3–6), do not file 15 independent "couldn't test X" issues. Instead:
- File the root-cause issue normally (per severity rubric — usually Critical or High).
- For each downstream section that could not be tested as a result, file one issue (or one consolidated issue covering all blocked sections) with `Category: Blocked` and a `Blocked By: ISSUE-XXX` field pointing to the root cause.
- Once the root cause is fixed, the blocked issues should be re-tested before being closed — don't assume the blocker's fix silently resolves them.

---

## Deliverable

For every issue found, create a separate Markdown file in a root-level `/issues` folder, named `ISSUE-XXX-short-slug.md`, using this template:

```markdown
# ISSUE-XXX: <Short descriptive title>

## Summary
One or two sentences describing the defect or gap.

## Location / Flow
Where in the app this occurs (e.g., "Navbar → My Account → Orders tab"), including role/auth state if relevant.

## Steps to Reproduce
1. ...
2. ...
3. ...
(If this issue consolidates multiple reproduction paths per the Deduplication Rule, list each as 1a/1b/1c or a labeled sub-scenario.)

## Expected Behavior
What the spec, or standard UX/security practice, says should happen.

## Actual Behavior
What actually happens.

## Severity
Critical / High / Medium / Low — per the Severity Rubric above.

## Category
(e.g., Navigation / Auth / Forms / CRUD / Payments / Security / Accessibility / Performance / Usability / Blocked)

## Blocked By
(Issue ID this depends on, if this issue could only be partially tested or not tested at all due to another defect — omit if not applicable)

## Scope
- **In Scope:** What this issue covers.
- **Out of Scope:** What is deliberately excluded from this specific fix.

## Acceptance Criteria
- [ ] Condition 1
- [ ] Condition 2
- [ ] Condition 3

## Related Feature/Ticket ID
(if a spec or backlog reference exists)

## Status
Open / Fixed — Pending Re-verification / Verified Fixed / Reopened
(Set to Open on first filing. Update per the Re-Audit Protocol below — never edit past status history, append instead.)

## Notes
Any additional context, screenshots, or edge cases worth flagging.
```

After completing the audit, produce a summary `ISSUES-INDEX.md` in the `/issues` folder listing all issues with ID, title, category, severity, and status for quick scanning — grouped by severity (Critical first) so the highest-impact items are resolved first.

---

## Re-Audit / Regression Protocol (NEW)

This template supports more than a single one-shot pass. When re-running the audit after fixes have been made:

1. Read the existing `ISSUES-INDEX.md` first. Do not start from a blank slate.
2. For each issue currently marked `Open` or `Fixed — Pending Re-verification`, re-run its exact "Steps to Reproduce." Update its `Status`:
   - Still broken → leave `Open`, add a dated note.
   - No longer reproducible → set `Verified Fixed`.
   - Was marked `Verified Fixed` previously but is broken again → set `Reopened`, add a dated note explaining what regressed.
3. Re-run sections that were previously blocked (`Blocked By` issues) once their root cause shows `Verified Fixed` — do not assume the fix cascades automatically.
4. Only after re-verification, proceed with a fresh pass of untested areas (new features, expanded scope) using the normal audit flow above.
5. Regenerate `ISSUES-INDEX.md` reflecting current status of all issues (old + new) — never delete historical issue files, even once verified fixed, so the audit trail persists.

---

## Process Instructions
- Work through each section systematically rather than randomly; don't skip a section even if it seems low-risk for this project — mark it "N/A — not applicable to this app" instead of omitting it silently.
- Test every role listed in Project Context against every relevant flow, not just the primary role.
- If a flow can't be tested because a feature isn't implemented yet, log it as an issue anyway (severity + note that it's a gap vs. a bug), rather than skipping silently.
- If a flow can't be tested because required test data/access is missing (see Test Data & Access section), log it as an issue and stop that specific check rather than fabricating data.
- Apply the Deduplication Rule and Cascading Failure Rule before filing any new issue.
- Do not fix issues — only identify, document, and file them.
- Prioritize issues that block a core flow (Critical) over cosmetic/copy issues (Low) in the index ordering.
