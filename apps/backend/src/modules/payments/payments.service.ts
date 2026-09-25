import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import {
  ProcessedEvent,
  ProcessedEventDocument,
} from './schemas/processed-event.schema';
import { Offer, OfferDocument } from '../offers/schemas/offer.schema';
import {
  ServiceRequest,
  ServiceRequestDocument,
} from '../requests/schemas/service-request.schema';
import { StripeService } from './stripe.service';
import { PaymentsWebhookService } from './payments-webhook.service';
import { MarketplaceGateway } from '../socket/socket.gateway';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PaymentIntentResponseDto } from './dto/payment-intent-response.dto';
import { PaymentEntity } from './interfaces/payment.interface';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(ProcessedEvent.name)
    private readonly processedEventModel: Model<ProcessedEventDocument>,
    @InjectModel(Offer.name)
    private readonly offerModel: Model<OfferDocument>,
    @InjectModel(ServiceRequest.name)
    private readonly requestModel: Model<ServiceRequestDocument>,
    private readonly stripeService: StripeService,
    private readonly marketplaceGateway: MarketplaceGateway,
    private readonly paymentsWebhookService: PaymentsWebhookService,
  ) {}

  /**
   * Creates a Stripe PaymentIntent for an accepted offer.
   * - Server-calculated pricing: amount is derived strictly from offer.price * 100.
   * - Verifies caller is the customer who owns and accepted the service request.
   * - Prevents duplicate payment creation if already SUCCEEDED.
   */
  async createPaymentIntent(
    customerId: string,
    dto: CreatePaymentIntentDto,
  ): Promise<PaymentIntentResponseDto> {
    const offer = await this.offerModel.findById(dto.offerId);
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    const request = await this.requestModel.findById(offer.requestId);
    if (!request) {
      throw new NotFoundException('Service request not found');
    }

    // Authorization: only the customer who accepted this offer can create a payment intent
    if (request.customerId !== customerId) {
      throw new ForbiddenException(
        'Only the customer who accepted this offer can create a payment intent',
      );
    }

    // Must be in ACCEPTED state
    if (offer.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Offer must be in ACCEPTED status to create a payment intent',
      );
    }

    if (request.status === 'PAID') {
      throw new BadRequestException('Service request has already been paid');
    }

    if (request.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Service request must be in ACCEPTED status awaiting payment',
      );
    }

    // Server-enforced pricing in cents
    const amount = Math.round(offer.price * 100);

    // Check if an existing payment record exists for this offer
    const existingPayment = await this.paymentModel.findOne({
      offerId: offer.id,
    });

    if (existingPayment && existingPayment.status === 'SUCCEEDED') {
      throw new BadRequestException('Payment for this offer has already succeeded');
    }

    // Create Stripe PaymentIntent with metadata
    const paymentIntent = await this.stripeService.createPaymentIntent(
      amount,
      'usd',
      {
        requestId: request.id || (request as any)._id?.toString(),
        offerId: offer.id || (offer as any)._id?.toString(),
        customerId,
        providerId: offer.providerId,
      },
    );

    if (existingPayment && existingPayment.status === 'PENDING') {
      // Reuse existing record and update with latest PaymentIntent
      existingPayment.stripePaymentIntentId = paymentIntent.id;
      existingPayment.amount = amount;
      await existingPayment.save();
    } else {
      await this.paymentModel.create({
        requestId: request.id || (request as any)._id?.toString(),
        offerId: offer.id || (offer as any)._id?.toString(),
        customerId,
        providerId: offer.providerId,
        amount,
        currency: 'usd',
        status: 'PENDING',
        stripePaymentIntentId: paymentIntent.id,
      });
    }

    return {
      clientSecret: paymentIntent.client_secret || '',
      paymentIntentId: paymentIntent.id,
      amount,
      currency: 'usd',
    };
  }

  /**
   * Processes Stripe webhooks with cryptographic verification and strict idempotency.
   * - Verifies HMAC-SHA256 signature using raw body buffer.
   * - Checks processed_events collection to prevent duplicate execution.
   * - Updates Payment and ServiceRequest status upon payment_intent.succeeded.
   * - Updates Payment status upon payment_intent.payment_failed.
   * - Dispatches Socket.IO payment:succeeded event.
   */
  async handleWebhook(
    signature: string,
    rawBody: Buffer | string,
  ): Promise<{ received: boolean }> {
    let event: Stripe.Event;

    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Invalid Stripe webhook signature';
      this.logger.warn(`Stripe webhook signature verification failed: ${errorMsg}`);
      throw new BadRequestException(`Invalid Stripe webhook signature: ${errorMsg}`);
    }

    const result = await this.paymentsWebhookService.processEvent(event);
    return { received: result.received };
  }

  /**
   * Retrieves payment details for a service request.
   * Access is restricted to the request's Customer or Provider.
   */
  async getPaymentByRequestId(
    userId: string,
    requestId: string,
  ): Promise<PaymentEntity> {
    const payment = await this.paymentModel.findOne({ requestId });
    if (!payment) {
      throw new NotFoundException('Payment record not found for this request');
    }

    if (payment.customerId !== userId && payment.providerId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to view this payment information',
      );
    }

    return this.mapToEntity(payment);
  }

  private mapToEntity(doc: PaymentDocument): PaymentEntity {
    return {
      id: doc.id || (doc as any)._id?.toString(),
      requestId: doc.requestId,
      offerId: doc.offerId,
      customerId: doc.customerId,
      providerId: doc.providerId,
      amount: doc.amount,
      currency: doc.currency,
      status: doc.status,
      stripePaymentIntentId: doc.stripePaymentIntentId,
      createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: doc.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
