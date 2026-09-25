# Rule: Code Standards & Practices

Every prompt execution and implementation task must follow these code standards:

- **TypeScript**: Strict mode enabled. No `any`. Explicit interfaces for DTOs, events, and return types.
- **NestJS**:
  - DTO validation on all endpoints with `class-validator` and `ValidationPipe({ whitelist: true })`.
  - Secure routes with `JwtAuthGuard` and `RolesGuard`.
  - Standard error response format `{ statusCode, message, errors, timestamp, path }`.
- **MongoDB / Mongoose**:
  - Timestamps enabled, explicit field typing.
  - Unique index on `email`, compound index on `requestId` + `status`, unique index on Stripe `eventId`.
  - Enforce pagination on all list queries (`limit` max 50).
- **Redis**:
  - Key namespacing (`mkt:...`).
  - Strict TTL on all locks; safe Lua script unlock with token validation.
- **Stripe**:
  - Signature verification with raw body (`stripe.webhooks.constructEvent`).
  - Never trust client amounts.
- **Next.js 16**:
  - App Router, Turbopack, React 19, clean component breakdown, dark theme styling matching `ui-context.md`.
- Source of truth: `context/code-standards.md`.
