import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import {
  ServiceRequest,
  ServiceRequestDocument,
} from '../requests/schemas/service-request.schema';
import { Offer, OfferDocument } from '../offers/schemas/offer.schema';
import {
  ConversationEntity,
  MessageEntity,
  PaginatedResponse,
} from './interfaces/chat.interface';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(ServiceRequest.name)
    private readonly requestModel: Model<ServiceRequestDocument>,
    @InjectModel(Offer.name)
    private readonly offerModel: Model<OfferDocument>,
  ) {}

  /**
   * Creates or returns an existing conversation for an accepted request.
   * Handles concurrent creation races gracefully via unique index on requestId.
   */
  async getOrCreateConversation(
    requestId: string,
    customerId: string,
    providerId: string,
  ): Promise<ConversationEntity> {
    if (!requestId || !customerId || !providerId) {
      throw new BadRequestException(
        'requestId, customerId, and providerId are required to create a conversation',
      );
    }

    // Check if conversation already exists
    let conversation = await this.conversationModel
      .findOne({ requestId })
      .exec();
    if (conversation) {
      return this.toConversationEntity(conversation);
    }

    try {
      const created = await this.conversationModel.create({
        requestId,
        customerId,
        providerId,
      });
      this.logger.log(
        `Created conversation ${created.id || created._id} for request ${requestId}`,
      );
      return this.toConversationEntity(created);
    } catch (err: any) {
      // Graceful E11000 duplicate key race resolution
      if (err.code === 11000) {
        this.logger.log(
          `Race condition on conversation creation for request ${requestId}. Fetching existing record.`,
        );
        conversation = await this.conversationModel
          .findOne({ requestId })
          .exec();
        if (conversation) {
          return this.toConversationEntity(conversation);
        }
      }
      throw err;
    }
  }

  /**
   * Retrieves a conversation by its MongoDB ID.
   */
  async getConversationById(id: string): Promise<ConversationEntity | null> {
    const doc = await this.conversationModel.findById(id).lean().exec();
    if (!doc) {
      return null;
    }
    return this.toConversationEntity(doc);
  }

  /**
   * Retrieves or automatically resolves a conversation by requestId.
   * Enforces server-side authorization: caller must be either the customer or the provider.
   */
  async getConversationByRequestId(
    requestId: string,
    userId: string,
  ): Promise<ConversationEntity> {
    // 1. Check if conversation already exists
    const existing = await this.conversationModel
      .findOne({ requestId })
      .exec();

    if (existing) {
      if (userId !== existing.customerId && userId !== existing.providerId) {
        throw new ForbiddenException(
          'You are not authorized to access this conversation',
        );
      }
      return this.toConversationEntity(existing);
    }

    // 2. Conversation does not exist yet: resolve parent request
    const request = await this.requestModel.findById(requestId).exec();
    if (!request) {
      throw new NotFoundException(
        `Service request with ID ${requestId} not found`,
      );
    }

    // Check that request has been accepted
    if (request.status === 'OPEN' || !request.acceptedOfferId) {
      throw new BadRequestException(
        'Conversation cannot be created for a request that has not been accepted',
      );
    }

    // 3. Resolve accepted offer to obtain providerId
    const acceptedOffer = await this.offerModel
      .findById(request.acceptedOfferId)
      .exec();
    if (!acceptedOffer) {
      throw new NotFoundException(
        `Accepted offer with ID ${request.acceptedOfferId} not found`,
      );
    }

    const customerId = request.customerId.toString();
    const providerId = acceptedOffer.providerId.toString();

    // Verify caller is a participant
    if (userId !== customerId && userId !== providerId) {
      throw new ForbiddenException(
        'You are not authorized to access this conversation',
      );
    }

    // 4. Create or fetch conversation
    return this.getOrCreateConversation(requestId, customerId, providerId);
  }

  /**
   * Internal / service method to ensure conversation exists for a request.
   */
  async ensureConversation(
    requestId: string,
    userId?: string,
    customerId?: string,
    providerId?: string,
  ): Promise<ConversationEntity> {
    if (customerId && providerId) {
      return this.getOrCreateConversation(requestId, customerId, providerId);
    }

    if (userId) {
      return this.getConversationByRequestId(requestId, userId);
    }

    // If no userId provided, resolve request directly
    const request = await this.requestModel.findById(requestId).exec();
    if (!request) {
      throw new NotFoundException(
        `Service request with ID ${requestId} not found`,
      );
    }

    if (request.status === 'OPEN' || !request.acceptedOfferId) {
      throw new BadRequestException(
        'Conversation cannot be created for a request that has not been accepted',
      );
    }

    const acceptedOffer = await this.offerModel
      .findById(request.acceptedOfferId)
      .exec();
    if (!acceptedOffer) {
      throw new NotFoundException(
        `Accepted offer with ID ${request.acceptedOfferId} not found`,
      );
    }

    return this.getOrCreateConversation(
      requestId,
      request.customerId.toString(),
      acceptedOffer.providerId.toString(),
    );
  }

  /**
   * Persists a chat message in MongoDB.
   * Enforces non-empty sanitized content and validates sender is a participant.
   */
  async saveMessage(
    conversationId: string,
    senderId: string,
    content: string,
  ): Promise<MessageEntity> {
    const trimmed = typeof content === 'string' ? content.trim() : '';
    if (!trimmed) {
      throw new BadRequestException('Message content cannot be empty');
    }

    if (trimmed.length > 2000) {
      throw new BadRequestException(
        'Message content cannot exceed 2000 characters',
      );
    }

    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();
    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found`,
      );
    }

    // Verify sender is participant
    if (
      senderId !== conversation.customerId &&
      senderId !== conversation.providerId
    ) {
      throw new ForbiddenException(
        'Sender is not a participant in this conversation',
      );
    }

    const messageDoc = await this.messageModel.create({
      conversationId,
      senderId,
      content: trimmed,
    });

    return this.toMessageEntity(messageDoc);
  }

  /**
   * Retrieves paginated messages for a conversation in reverse chronological order.
   * Enforces server-side authorization: caller must be a participant.
   */
  async getMessages(
    conversationId: string,
    userId: string,
    query?: GetMessagesQueryDto,
  ): Promise<PaginatedResponse<MessageEntity>> {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .exec();
    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found`,
      );
    }

    // Enforce participant authorization
    if (
      userId !== conversation.customerId &&
      userId !== conversation.providerId
    ) {
      throw new ForbiddenException(
        'You are not authorized to view messages for this conversation',
      );
    }

    const page = query?.page && query.page > 0 ? query.page : 1;
    const limit =
      query?.limit && query.limit > 0 ? Math.min(query.limit, 50) : 30;
    const skip = (page - 1) * limit;

    const [total, docs] = await Promise.all([
      this.messageModel.countDocuments({ conversationId }).exec(),
      this.messageModel
        .find({ conversationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    const data = docs.map((doc) => this.toMessageEntity(doc));
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Converts a Mongoose conversation document to ConversationEntity.
   */
  private toConversationEntity(doc: any): ConversationEntity {
    return {
      id: doc._id ? doc._id.toString() : doc.id,
      requestId: doc.requestId,
      customerId: doc.customerId,
      providerId: doc.providerId,
      createdAt:
        doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : doc.createdAt || new Date().toISOString(),
      updatedAt:
        doc.updatedAt instanceof Date
          ? doc.updatedAt.toISOString()
          : doc.updatedAt || new Date().toISOString(),
    };
  }

  /**
   * Converts a Mongoose message document to MessageEntity.
   */
  private toMessageEntity(doc: any): MessageEntity {
    return {
      id: doc._id ? doc._id.toString() : doc.id,
      conversationId: doc.conversationId,
      senderId: doc.senderId,
      content: doc.content,
      createdAt:
        doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : doc.createdAt || new Date().toISOString(),
    };
  }
}
