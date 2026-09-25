import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, HydratedDocument } from 'mongoose';
import { UserRole } from '../interfaces/user.interface';

export type UserDocument = HydratedDocument<User>;

@Schema({
  collection: 'users',
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = ret._id ? ret._id.toString() : ret.id;
      delete ret._id;
      delete ret.__v;
      delete ret.passwordHash;
      return ret;
    },
  },
})
export class User {
  id?: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  email!: string;

  @Prop({
    type: String,
    required: true,
  })
  passwordHash!: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  name!: string;

  @Prop({
    type: String,
    required: true,
    enum: ['customer', 'provider'],
  })
  role!: UserRole;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

