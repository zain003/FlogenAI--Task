import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({
  collection: 'messages',
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
export class Message {
  id?: string;

  @Prop({
    type: String,
    required: true,
  })
  conversationId!: string;

  @Prop({
    type: String,
    required: true,
  })
  senderId!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 2000,
  })
  content!: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Compound index on (conversationId, createdAt) for sub-50ms reverse-chronological pagination
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ createdAt: -1 });
