# 000-shared-contracts.md — Single Source of Truth

This file contains all core data models, TypeScript interfaces, enum definitions, API response shapes, and authorization patterns for the Real-Time Service Marketplace.

---

## 1. Domain Entities & TypeScript Models

```typescript
// Roles & Enums
export type UserRole = 'customer' | 'provider';

export type RequestStatus = 'OPEN' | 'ACCEPTED' | 'PAID' | 'COMPLETED' | 'CANCELLED';

export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

// User Entity
export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

// Service Request Entity
export interface ServiceRequestEntity {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: RequestStatus;
  customerId: string;
  acceptedOfferId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Offer Entity
export interface OfferEntity {
  id: string;
  requestId: string;
  providerId: string;
  price: number;
  message: string;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
}

// Payment Entity
export interface PaymentEntity {
  id: string;
  requestId: string;
  offerId: string;
  customerId: string;
  providerId: string;
  amount: number; // in cents
  currency: 'usd';
  status: PaymentStatus;
  stripePaymentIntentId: string;
  createdAt: string;
  updatedAt: string;
}

// Conversation Entity
export interface ConversationEntity {
  id: string;
  requestId: string;
  customerId: string;
  providerId: string;
  createdAt: string;
  updatedAt: string;
}

// Message Entity
export interface MessageEntity {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

// Processed Event Entity (Stripe Webhook Idempotency)
export interface ProcessedEventEntity {
  id: string; // Stripe Event ID (e.g. evt_123456)
  eventType: string;
  processedAt: string;
}
```

---

## 2. API Request DTOs & Validation Contracts

```typescript
// Auth DTOs
export interface RegisterDto {
  email: string; // valid email format
  password: string; // min 8 characters
  name: string; // min 2 characters
  role: UserRole; // 'customer' | 'provider'
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

// Service Request DTOs
export interface CreateRequestDto {
  title: string; // 3 - 100 chars
  description: string; // 10 - 2000 chars
  budget: number; // positive number > 0
}

// Offer DTOs
export interface CreateOfferDto {
  price: number; // positive number > 0
  message: string; // 5 - 1000 chars
}

// Payment DTOs
export interface CreatePaymentIntentDto {
  offerId: string;
}

export interface PaymentIntentResponseDto {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}
```

---

## 3. Standard API Response & Error Shapes

All REST endpoints return predictable shapes:

```typescript
// Success List Wrapper (Enforced Pagination)
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Standard Error Response Shape
export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  errors?: string[];
  timestamp: string;
  path: string;
}
```

---

## 4. Socket.IO Real-Time Event Contracts

All Socket.IO events transmit strongly typed payloads:

```typescript
// Server -> Client Events
export interface ServerToClientEvents {
  'request:created': (payload: { request: ServiceRequestEntity }) => void;
  'offer:created': (payload: { offer: OfferEntity; requestTitle: string }) => void;
  'offer:accepted': (payload: { offer: OfferEntity; requestId: string }) => void;
  'request:closed': (payload: { requestId: string }) => void;
  'message:new': (payload: { message: MessageEntity }) => void;
  'error': (payload: { message: string; code?: string }) => void;
}

// Client -> Server Events
export interface ClientToServerEvents {
  'conversation:join': (payload: { conversationId: string }, callback: (response: { status: 'ok' | 'error'; message?: string }) => void) => void;
  'message:send': (payload: { conversationId: string; content: string }, callback: (response: { status: 'ok' | 'error'; message?: MessageEntity }) => void) => void;
}

// Socket Auth Handshake Payload
export interface SocketAuthHandshake {
  auth: {
    token: string; // Bearer JWT
  };
}

// Authenticated Socket User Data
export interface SocketUserData {
  id: string;
  email: string;
  role: UserRole;
}
```

---

## 5. Auth & Permission Model

1. **JWT Payload Structure**:
   ```typescript
   export interface JwtPayload {
     sub: string; // User ID
     email: string;
     role: UserRole;
     iat?: number;
     exp?: number;
   }
   ```
2. **Access Control Decorator**: `@Roles('customer' | 'provider')`
3. **Guards Execution Order**:
   - `JwtAuthGuard`: Validates Bearer token in `Authorization` header. Sets `request.user`.
   - `RolesGuard`: Compares `request.user.role` with endpoint required roles.
   - Resource Ownership Check: Implemented inside service/controller before mutation.

---

## 6. Naming Conventions

- **Filenames**: kebab-case (`requests.controller.ts`, `service-request.schema.ts`, `auth.service.ts`).
- **Interfaces/Types**: PascalCase (`ServiceRequestEntity`, `CreateOfferDto`).
- **Functions/Methods**: camelCase (`createServiceRequest`, `acceptOfferWithLock`).
- **Database Collections**: plural snake_case (`service_requests`, `offers`, `payments`, `users`).
- **Redis Keys**: colon-delimited with domain namespace (`mkt:lock:request:<id>`, `mkt:rate:<key>`).
