# Contract Changelog

This file tracks every change to a "Provides/Exposes" function or endpoint signature.
Format: `[FILE-ID] — old signature — new signature — reason`

| File ID | Old Signature | New Signature | Reason | Date |
| :--- | :--- | :--- | :--- | :--- |
| **FEAT-006** | N/A | `GET /api/health` -> `{ status: 'ok', uptime: number, timestamp: string }` | Added zero-dependency health probe for Docker container healthchecks and Nginx load balancer | 2026-09-25 |
