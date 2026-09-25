import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { OfferStatus } from '../interfaces/offer.interface';

export type OfferDocument = HydratedDocument<Offer>;

@Schema({
  collection: 'offers',
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
export class Offer {
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
  providerId!: string;

  @Prop({
    type: Number,
    required: true,
    min: 1,
  })
  price!: number;

  @Prop({
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 1000,
  })
  message!: string;

  @Prop({
    type: String,
    required: true,
    enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
    default: 'PENDING',
  })
  status!: OfferStatus;

  createdAt?: Date;
  updatedAt?: Date;
}

export const OfferSchema = SchemaFactory.createForClass(Offer);

// Compound and single indexes per architectural contracts
OfferSchema.index({ requestId: 1, status: 1 });
OfferSchema.index({ providerId: 1 });
OfferSchema.index({ requestId: 1 });
OfferSchema.index({ createdAt: -1 });
