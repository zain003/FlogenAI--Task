import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import {
  ProcessedEvent,
  ProcessedEventDocument,
} from './schemas/processed-event.schema';
import {
  ServiceRequest,
  ServiceRequestDocument,
} from '../requests/schemas/service-request.schema';
import { MarketplaceGateway } from '../socket/socket.gateway';

export interface ProcessedEventEntity {
  id: string; // Stripe Event ID
  eventType: string;
  processedAt: string;
}

export interface WebhookProcessResult {
  received: boolean;
  processed: boolean;
  eventId: string;
}

@Injectable()
export class PaymentsWebhookService {
  private readonly logger = new Logger(PaymentsWebhookService.name);

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(ProcessedEvent.name)
    private readonly processedEventModel: Model<ProcessedEventDocument>,
    @InjectModel(ServiceRequest.name)
    private readonly requestModel: Model<ServiceRequestDocument>,
    private readonly marketplaceGateway: MarketplaceGateway,
  ) {}

  /**
   * Processes a verified Stripe webhook event with strict idempotency and state reconciliation.
   *
   * Flow:
   * 1. Checks if event ID is already recorded in `processed_events`.
   *    If found -> returns immediately without any state mutations (at-least-once safe).
   * 2. Persists event ID in `processed_events` collection with duplicate key (E11000) collision guard.
   * 3. Executes domain state mutations:
   *    - `payment_intent.succeeded`: Marks Payment as SUCCEEDED, transitions ServiceRequest
   *      to PAID, and dispatches `payment:succeeded` Socket.IO event to Customer and Provider.
   *    - `payment_intent.payment_failed`: Marks Payment as FAILED.
   *
   * @param event - The cryptographically verified Stripe event.
   * @returns WebhookProcessResult indicating receipt and whether mutations occurred.
   */
  async processEvent(event: Stripe.Event): Promise<WebhookProcessResult> {
    const eventId = event.id;
    const eventType = event.type;

    // 1. Idempotency Check in MongoDB
    const existingEvent = await this.processedEventModel.findById(eventId);
    if (existingEvent) {
      this.logger.log(
        `[Idempotency] Stripe event ${eventId} (${eventType}) was already processed. Acknowledging with HTTP 200 without mutations.`,
      );
      return { received: true, processed: false, eventId };
    }

    // 2. Primary Key Idempotency Guard (processed_events table)
    try {
      await this.processedEventModel.create({
        _id: eventId,
        eventType,
        processedAt: new Date(),
      });
    } catch (err: any) {
      // Handle race condition where two identical webhook deliveries arrive concurrently
      if (err?.code === 11000) {
        this.logger.log(
          `[Idempotency Race] Stripe event ${eventId} concurrently recorded by parallel delivery. Acknowledging without mutations.`,
        );
        return { received: true, processed: false, eventId };
      }
      this.logger.error(
        `Failed to record processed event ${eventId}: ${err?.message}`,
        err?.stack,
      );
      throw err;
    }

    // 3. Domain Event State Reconciliation
    switch (eventType) {
      case 'payment_intent.succeeded': {
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      }

      default:
        this.logger.log(`Unhandled Stripe event type: ${eventType}`);
    }

    return { received: true, processed: true, eventId };
  }

  /**
   * Reconciles database records upon payment_intent.succeeded.
   */
  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const payment = await this.paymentModel.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!payment) {
      this.logger.warn(
        `Payment record not found for PaymentIntent ${paymentIntent.id}. State reconciliation skipped.`,
      );
      return;
    }

    // 1. Transition Payment to SUCCEEDED
    payment.status = 'SUCCEEDED';
    await payment.save();

    // 2. Atomically transition ServiceRequest to PAID
    await this.requestModel.findByIdAndUpdate(payment.requestId, {
      $set: { status: 'PAID' },
    });

    // 3. Dispatch real-time Socket.IO notification across cluster via Redis adapter
    this.marketplaceGateway.emitPaymentSucceeded(
      payment.customerId,
      payment.providerId,
      payment.requestId,
      payment.amount,
    );

    this.logger.log(
      `Reconciled payment ${payment.id}: status SUCCEEDED, request ${payment.requestId} marked PAID. Real-time notification dispatched.`,
    );
  }

  /**
   * Reconciles database records upon payment_intent.payment_failed.
   */
  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const payment = await this.paymentModel.findOne({
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!payment) {
      this.logger.warn(
        `Payment record not found for failed PaymentIntent ${paymentIntent.id}.`,
      );
      return;
    }

    payment.status = 'FAILED';
    await payment.save();

    this.logger.log(
      `Reconciled payment ${payment.id}: status marked FAILED for PaymentIntent ${paymentIntent.id}`,
    );
  }
}
