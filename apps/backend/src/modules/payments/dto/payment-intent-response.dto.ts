export class PaymentIntentResponseDto {
  clientSecret!: string;
  paymentIntentId!: string;
  amount!: number; // in cents
  currency!: string;
}
