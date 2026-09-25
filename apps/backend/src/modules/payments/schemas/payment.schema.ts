import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PaymentStatus } from '../interfaces/payment.interface';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({
  collection: 'payments',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id ? ret._id.toString() : ret.id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class Payment {
  id?: string;

  @Prop({
    type: String,
    required: true,
  })
  requestId!: string;

  @Prop({
    type: String,
    required: true,
  })
  offerId!: string;

  @Prop({
    type: String,
    required: true,
  })
  customerId!: string;

  @Prop({
    type: String,
    required: true,
  })
  providerId!: string;

  @Prop({
    type: Number,
    required: true,
    min: 1,
  })
  amount!: number; // in cents

  @Prop({
    type: String,
    required: true,
    default: 'usd',
  })
  currency!: string;

  @Prop({
    type: String,
    required: true,
    enum: ['PENDING', 'SUCCEEDED', 'FAILED'],
    default: 'PENDING',
  })
  status!: PaymentStatus;

  @Prop({
    type: String,
    required: true,
  })
  stripePaymentIntentId!: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// Indexes per architectural contracts
PaymentSchema.index({ stripePaymentIntentId: 1 }, { unique: true });
PaymentSchema.index({ requestId: 1 });
PaymentSchema.index({ customerId: 1 });
PaymentSchema.index({ providerId: 1 });
PaymentSchema.index({ createdAt: -1 });
