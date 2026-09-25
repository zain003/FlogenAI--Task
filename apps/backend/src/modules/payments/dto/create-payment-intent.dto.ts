import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsString({ message: 'offerId must be a string' })
  @IsNotEmpty({ message: 'offerId is required' })
  offerId!: string;
}
