import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from '../chat/chat.service';
import { MessageEntity } from '../chat/interfaces/chat.interface';

export interface JoinConversationPayload {
  conversationId: string;
}

export interface SendMessagePayload {
  conversationId: string;
  content: string;
}

export interface GatewayResponse<T = any> {
  status: 'ok' | 'error';
  message?: T;
  error?: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validates socket connection token if not already attached by MarketplaceGateway.
   */
  async handleConnection(client: Socket): Promise<void> {
    if (client.data?.user) return;

    try {
      const token =
        client.handshake?.auth?.token ||
        (client.handshake?.headers?.authorization
          ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : null);

      if (!token) return;

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret });
      client.data.user = {
        id: payload.sub || payload.id,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      // Ignored here if token invalid
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Chat client disconnected: ${client.id}`);
  }

  /**
   * Subscribes to 'conversation:join'.
   * Enforces server-side authorization: caller must be customer or provider of the conversation.
   */
  @SubscribeMessage('conversation:join')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinConversationPayload,
  ): Promise<GatewayResponse> {
    const user = client.data?.user;
    if (!user || !user.id) {
      return { status: 'error', error: 'Unauthorized: User not authenticated' };
    }

    if (!payload?.conversationId) {
      return { status: 'error', error: 'Missing conversationId' };
    }

    // Query conversation in MongoDB to verify participant authorization
    const conversation = await this.chatService.getConversationById(
      payload.conversationId,
    );

    if (!conversation) {
      return { status: 'error', error: 'Conversation not found' };
    }

    // Server-side authorization check: must be customer or provider
    const isParticipant =
      user.id === conversation.customerId || user.id === conversation.providerId;

    if (!isParticipant) {
      this.logger.warn(
        `Unauthorized room join attempt: user ${user.id} (${user.email}) rejected for conversation ${payload.conversationId}`,
      );
      return { status: 'error', error: 'Unauthorized room access' };
    }

    // Join authorized room
    const roomName = `conversation:${payload.conversationId}`;
    client.join(roomName);
    this.logger.log(
      `User ${user.id} (${user.email}) joined authorized room '${roomName}'`,
    );

    return { status: 'ok' };
  }

  /**
   * Subscribes to 'message:send'.
   * - Validates non-empty content (max 2000 chars).
   * - Verifies caller is currently authorized and joined in 'conversation:<id>'.
   * - Persists message to MongoDB before broadcasting.
   * - Broadcasts 'message:new' to 'conversation:<id>' across all cluster instances via Redis Adapter.
   */
  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ): Promise<GatewayResponse<MessageEntity>> {
    const user = client.data?.user;
    if (!user || !user.id) {
      return { status: 'error', error: 'Unauthorized: User not authenticated' };
    }

    const trimmed = typeof payload?.content === 'string' ? payload.content.trim() : '';
    if (!trimmed) {
      return { status: 'error', error: 'Message content cannot be empty' };
    }

    if (trimmed.length > 2000) {
      return {
        status: 'error',
        error: 'Message content exceeds maximum length of 2000 characters',
      };
    }

    const roomName = `conversation:${payload.conversationId}`;

    // Verify conversation exists and user is participant
    const conversation = await this.chatService.getConversationById(
      payload.conversationId,
    );

    if (!conversation) {
      return { status: 'error', error: 'Conversation not found' };
    }

    const isParticipant =
      user.id === conversation.customerId || user.id === conversation.providerId;

    if (!isParticipant) {
      this.logger.warn(
        `Unauthorized message send attempt by user ${user.id} for conversation ${payload.conversationId}`,
      );
      return {
        status: 'error',
        error: 'Unauthorized: Not a participant in this conversation',
      };
    }

    // Verify caller is joined to conversation room
    const isJoined = client.rooms?.has
      ? client.rooms.has(roomName)
      : Array.isArray(client.rooms)
        ? client.rooms.includes(roomName)
        : false;

    if (!isJoined) {
      this.logger.warn(
        `Message send rejected: Socket ${client.id} is not joined to room '${roomName}'`,
      );
      return {
        status: 'error',
        error: 'Socket is not joined to conversation room. Call conversation:join first.',
      };
    }

    try {
      // 1. Persist message in MongoDB before broadcasting
      const savedMessage = await this.chatService.saveMessage(
        payload.conversationId,
        user.id,
        trimmed,
      );

      // 2. Broadcast message:new to room across cluster via Redis Adapter
      if (this.server) {
        this.server.to(roomName).emit('message:new', { message: savedMessage });
        this.logger.log(
          `Broadcasted message:new (${savedMessage.id}) to room '${roomName}'`,
        );
      }

      return { status: 'ok', message: savedMessage };
    } catch (err: any) {
      this.logger.error(
        `Failed to persist message for conversation ${payload.conversationId}: ${err?.message}`,
      );
      // Failure Behavior: If DB persistence fails, message is NOT broadcast, and caller callback receives error
      return { status: 'error', error: err?.message || 'Persistence failed' };
    }
  }
}
