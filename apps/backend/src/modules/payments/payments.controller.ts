import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBody,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { isValidObjectId } from 'mongoose';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PaymentIntentResponseDto } from './dto/payment-intent-response.dto';
import { PaymentEntity } from './interfaces/payment.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Customer creates a Stripe PaymentIntent for an accepted offer.
   * POST /api/payments/create-intent
   */
  @Post('create-intent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @HttpCode(HttpStatus.OK)
  async createPaymentIntent(
    @CurrentUser() user: any,
    @Body() dto: CreatePaymentIntentDto,
  ): Promise<PaymentIntentResponseDto> {
    const customerId = user.id || user.sub;
    return this.paymentsService.createPaymentIntent(customerId, dto);
  }

  /**
   * Simulated payment confirmation for sandbox / evaluation mode.
   * POST /api/payments/simulate-success
   */
  @Post('simulate-success')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @HttpCode(HttpStatus.OK)
  async simulatePaymentSuccess(
    @CurrentUser() user: any,
    @Body() dto: { paymentIntentId: string },
  ): Promise<{ success: boolean; status: string }> {
    if (!dto?.paymentIntentId) {
      throw new BadRequestException('paymentIntentId is required');
    }
    const customerId = user.id || user.sub;
    return this.paymentsService.simulatePaymentSuccess(customerId, dto.paymentIntentId);
  }

  /**
   * Stripe Webhook Receiver endpoint.
   * POST /api/payments/webhook
   * Validates raw body HMAC-SHA256 signature and performs idempotent processing.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
    @RawBody() rawBody?: Buffer,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const payloadBuffer: Buffer =
      rawBody ||
      req?.rawBody ||
      (Buffer.isBuffer(req?.body)
        ? req.body
        : Buffer.from(
            typeof req?.body === 'string'
              ? req.body
              : JSON.stringify(req?.body || ''),
          ));

    return this.paymentsService.handleWebhook(signature, payloadBuffer);
  }

  /**
   * Retrieves payment details for a specific service request.
   * GET /api/payments/by-request/:id
   */
  @Get('by-request/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'provider')
  @HttpCode(HttpStatus.OK)
  async getPaymentByRequest(
    @Param('id') requestId: string,
    @CurrentUser() user: any,
  ): Promise<PaymentEntity> {
    if (!isValidObjectId(requestId)) {
      throw new BadRequestException('Invalid request ID format');
    }
    const userId = user.id || user.sub;
    return this.paymentsService.getPaymentByRequestId(userId, requestId);
  }
}
