# ISSUE-010: Inconsistent WebSocket Environment Variable Resolution in Socket Context

## Summary
`SocketProvider` in `apps/frontend/src/context/socket-context.tsx` resolves the WebSocket gateway URL using `process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001'`. However, `context/feature-specs/000-infra-contracts.md` and `docker-compose.yml` declare `NEXT_PUBLIC_SOCKET_URL` (pointing to `http://localhost:8080`). Because `NEXT_PUBLIC_SOCKET_URL` is omitted from the fallback chain, the frontend falls back to port 3001, bypassing the Nginx load balancer.

## Location / Flow
- **Component:** `SocketProvider` (`apps/frontend/src/context/socket-context.tsx`, line 61)
- **Contract Specification:** `context/feature-specs/000-infra-contracts.md` (Table 1, line 21) & `docker-compose.yml` (line 104)
- **Flow:** Socket.IO client connection negotiation for all authenticated roles

## Steps to Reproduce
1. Start the platform using standard Docker configuration: `docker compose up -d`.
2. As defined in `000-infra-contracts.md`, the environment specifies:
   - `NEXT_PUBLIC_API_URL=http://localhost:8080/api`
   - `NEXT_PUBLIC_SOCKET_URL=http://localhost:8080`
3. Launch the frontend and inspect the client-side socket connection request in the browser Network tab.
4. Observe the destination URL:
   - `socket-context.tsx` attempts to connect to `http://localhost:3001` (fallback default) instead of `http://localhost:8080`.
5. If port 3001 is mapped directly to Node 1, connections bypass the Nginx reverse proxy load balancer (`ip_hash`). If port 3001 is not exposed to the host in production, socket connections fail entirely.

## Expected Behavior
Per `000-infra-contracts.md`:
- The client socket gateway URL must resolve `process.env.NEXT_PUBLIC_SOCKET_URL` first, supporting `NEXT_PUBLIC_WS_URL` as a secondary alias, and defaulting to `http://localhost:8080` (or `http://localhost:3001` for standalone local tests).

## Actual Behavior
`socket-context.tsx` only inspects `process.env.NEXT_PUBLIC_WS_URL`. When only `NEXT_PUBLIC_SOCKET_URL` is configured per spec, the client falls back to port 3001.

## Severity
**Medium** — Degrades load balancer routing and violates the infrastructure contracts specification, though direct port 3001 connections may succeed in basic local development.

## Category
Infrastructure / Configuration / Real-Time

## Scope
- **In Scope:**
  - Update `socket-context.tsx` to read `process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8080'`.
  - Update `.env.example` and documentation if needed.
- **Out of Scope:** Nginx configuration changes.

## Acceptance Criteria
- [ ] `SocketProvider` prioritizes `NEXT_PUBLIC_SOCKET_URL`.
- [ ] Connects cleanly to Nginx load balancer port 8080 in multi-instance Docker topology.
- [ ] Vitest component tests pass without regressions.

## Related Feature/Ticket ID
`FEAT-006-INT`, `000-infra-contracts.md`

## Status
Open

## Notes
Discovered during Phase 2 static contract auditing against `000-infra-contracts.md`.
