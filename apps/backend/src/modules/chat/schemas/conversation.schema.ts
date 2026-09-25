import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({
  collection: 'conversations',
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
export class Conversation {
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
  customerId!: string;

  @Prop({
    type: String,
    required: true,
  })
  providerId!: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Indexes per architectural and feature specs
ConversationSchema.index({ requestId: 1 }, { unique: true });
ConversationSchema.index({ customerId: 1 });
ConversationSchema.index({ providerId: 1 });
ConversationSchema.index({ createdAt: -1 });
