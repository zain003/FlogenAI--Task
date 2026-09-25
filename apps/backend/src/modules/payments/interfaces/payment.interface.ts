export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface PaymentEntity {
  id: string;
  requestId: string;
  offerId: string;
  customerId: string;
  providerId: string;
  amount: number; // in cents
  currency: 'usd' | string;
  status: PaymentStatus;
  stripePaymentIntentId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProcessedEventEntity {
  id: string; // Stripe Event ID
  eventType: string;
  processedAt: string;
}
