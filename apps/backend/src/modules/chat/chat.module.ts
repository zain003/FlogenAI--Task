import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import {
  Conversation,
  ConversationSchema,
} from './schemas/conversation.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import {
  ServiceRequest,
  ServiceRequestSchema,
} from '../requests/schemas/service-request.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { AuthModule } from '../auth/auth.module';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: ServiceRequest.name, schema: ServiceRequestSchema },
      { name: Offer.name, schema: OfferSchema },
    ]),
    AuthModule,
    forwardRef(() => SocketModule),
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService, MongooseModule],
})
export class ChatModule {}
