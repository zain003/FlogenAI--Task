import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('STRIPE_SECRET_KEY') ||
      process.env.STRIPE_SECRET_KEY ||
      '';

    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ||
      process.env.STRIPE_WEBHOOK_SECRET ||
      '';

    if (!apiKey) {
      this.logger.warn('STRIPE_SECRET_KEY is not defined in environment variables');
    }

    this.stripe = new Stripe(apiKey);
  }

  /**
   * Creates a Stripe PaymentIntent with server-enforced amount and metadata.
   */
  async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    metadata: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    this.logger.log(
      `Creating Stripe PaymentIntent for amount: ${amount} cents (${currency.toUpperCase()})`,
    );

    return this.stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }

  /**
   * Cryptographically verifies Stripe webhook signature using raw body buffer.
   */
  constructWebhookEvent(payload: Buffer | string, signature: string): Stripe.Event {
    if (!signature) {
      throw new Error('Missing stripe-signature header');
    }
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }
}
