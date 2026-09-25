import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { RequestStatus } from '../interfaces/request.interface';

export type ServiceRequestDocument = HydratedDocument<ServiceRequest>;

@Schema({
  collection: 'service_requests',
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
export class ServiceRequest {
  id?: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  title!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  description!: string;

  @Prop({
    type: Number,
    required: true,
    min: 1,
  })
  budget!: number;

  @Prop({
    type: String,
    required: true,
    enum: ['OPEN', 'ACCEPTED', 'PAID', 'COMPLETED', 'CANCELLED'],
    default: 'OPEN',
  })
  status!: RequestStatus;

  @Prop({
    type: String,
    required: true,
  })
  customerId!: string;

  @Prop({
    type: String,
    default: null,
  })
  acceptedOfferId?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ServiceRequestSchema =
  SchemaFactory.createForClass(ServiceRequest);

// Compound and single-field indexes per architectural contracts
ServiceRequestSchema.index({ status: 1, customerId: 1 });
ServiceRequestSchema.index({ customerId: 1 });
ServiceRequestSchema.index({ status: 1 });
ServiceRequestSchema.index({ createdAt: -1 });
