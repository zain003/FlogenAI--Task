import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProcessedEventDocument = HydratedDocument<ProcessedEvent>;

@Schema({
  collection: 'processed_events',
  timestamps: false,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class ProcessedEvent {
  @Prop({
    type: String,
    required: true,
  })
  _id!: string; // Stripe Event ID (e.g. evt_123456)

  @Prop({
    type: String,
    required: true,
  })
  eventType!: string;

  @Prop({
    type: Date,
    default: () => new Date(),
  })
  processedAt!: Date;
}

export const ProcessedEventSchema = SchemaFactory.createForClass(ProcessedEvent);
