import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { EnsureConversationDto } from './dto/ensure-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import {
  ConversationEntity,
  MessageEntity,
  PaginatedResponse,
} from './interfaces/chat.interface';

@Controller('conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Internal/Service endpoint to ensure a conversation exists for a request.
   * POST /api/conversations/ensure
   */
  @Post('ensure')
  @HttpCode(HttpStatus.OK)
  @Roles('customer', 'provider')
  async ensureConversation(
    @Body() dto: EnsureConversationDto,
    @CurrentUser() user: any,
  ): Promise<ConversationEntity> {
    return this.chatService.ensureConversation(
      dto.requestId,
      user.id,
      dto.customerId,
      dto.providerId,
    );
  }

  /**
   * Retrieves or automatically resolves conversation by service request ID.
   * GET /api/conversations/by-request/:requestId
   */
  @Get('by-request/:requestId')
  @Roles('customer', 'provider')
  async getByRequestId(
    @Param('requestId') requestId: string,
    @CurrentUser() user: any,
  ): Promise<ConversationEntity> {
    return this.chatService.getConversationByRequestId(requestId, user.id);
  }

  /**
   * Retrieves paginated message history for a conversation.
   * GET /api/conversations/:id/messages
   */
  @Get(':id/messages')
  @Roles('customer', 'provider')
  async getMessages(
    @Param('id') id: string,
    @Query() query: GetMessagesQueryDto,
    @CurrentUser() user: any,
  ): Promise<PaginatedResponse<MessageEntity>> {
    return this.chatService.getMessages(id, user.id, query);
  }

  /**
   * Saves and persists a new chat message in MongoDB.
   * POST /api/conversations/:id/messages
   */
  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @Roles('customer', 'provider')
  async createMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: any,
  ): Promise<MessageEntity> {
    return this.chatService.saveMessage(id, user.id, dto.content);
  }
}
