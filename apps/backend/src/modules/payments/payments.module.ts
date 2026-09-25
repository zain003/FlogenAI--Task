import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { PaymentsWebhookService } from './payments-webhook.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import {
  ProcessedEvent,
  ProcessedEventSchema,
} from './schemas/processed-event.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import {
  ServiceRequest,
  ServiceRequestSchema,
} from '../requests/schemas/service-request.schema';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [
    ConfigModule,
    SocketModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: ProcessedEvent.name, schema: ProcessedEventSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: ServiceRequest.name, schema: ServiceRequestSchema },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService, PaymentsWebhookService],
  exports: [PaymentsService, StripeService, PaymentsWebhookService],
})
export class PaymentsModule {}
