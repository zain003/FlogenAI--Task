import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Offer, OfferDocument } from './schemas/offer.schema';
import {
  ServiceRequest,
  ServiceRequestDocument,
} from '../requests/schemas/service-request.schema';
import { DistributedLockService } from '../redis/distributed-lock.service';
import { MarketplaceGateway } from '../socket/socket.gateway';
import { ChatService } from '../chat/chat.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { GetOffersQueryDto } from './dto/get-offers-query.dto';
import {
  AcceptOfferResponse,
  OfferEntity,
  PaginatedResponse,
} from './interfaces/offer.interface';

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    @InjectModel(Offer.name)
    private readonly offerModel: Model<OfferDocument>,
    @InjectModel(ServiceRequest.name)
    private readonly requestModel: Model<ServiceRequestDocument>,
    private readonly distributedLockService: DistributedLockService,
    private readonly marketplaceGateway: MarketplaceGateway,
    @Optional()
    @Inject(forwardRef(() => ChatService))
    private readonly chatService?: ChatService,
  ) {}

  /**
   * Helper to convert Mongoose documents to OfferEntity
   */
  private toEntity(doc: any): OfferEntity {
    return {
      id: doc._id ? doc._id.toString() : doc.id || '',
      requestId: doc.requestId ? doc.requestId.toString() : '',
      providerId: doc.providerId ? doc.providerId.toString() : '',
      price: doc.price,
      message: doc.message,
      status: doc.status,
      createdAt:
        doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : doc.createdAt
            ? new Date(doc.createdAt).toISOString()
            : new Date().toISOString(),
      updatedAt:
        doc.updatedAt instanceof Date
          ? doc.updatedAt.toISOString()
          : doc.updatedAt
            ? new Date(doc.updatedAt).toISOString()
            : new Date().toISOString(),
    };
  }

  /**
   * Provider submits an offer against an OPEN service request.
   * Emits `offer:created` to the customer's private room via Socket.IO / Redis adapter.
   *
   * Failure contract: socket delivery failure does NOT roll back the database
   * transaction; state is reconcilable on next page load.
   */
  async createOffer(
    requestId: string,
    providerId: string,
    createOfferDto: CreateOfferDto,
  ): Promise<OfferEntity> {
    if (!isValidObjectId(requestId)) {
      throw new BadRequestException('Invalid request ID format');
    }

    const request = await this.requestModel.findById(requestId).exec();
    if (!request) {
      throw new NotFoundException(`Service request with ID ${requestId} not found`);
    }

    if (request.status !== 'OPEN') {
      throw new BadRequestException(
        `Cannot submit offer on request with status '${request.status}'. Only OPEN requests accept offers.`,
      );
    }

    if (request.customerId === providerId) {
      throw new BadRequestException(
        'Customers cannot submit offers on their own service requests',
      );
    }

    const newOffer = new this.offerModel({
      requestId,
      providerId,
      price: createOfferDto.price,
      message: createOfferDto.message.trim(),
      status: 'PENDING',
    });

    const savedDoc = await newOffer.save();
    const entity = this.toEntity(savedDoc);

    this.logger.log(
      `Offer ${entity.id} created by provider ${providerId} for request ${requestId} at $${entity.price}`,
    );

    // Emit real-time offer:created event to the customer's private room.
    // Failure to deliver does NOT roll back the persisted offer (at-least-once contract).
    const customerId = request.customerId.toString();
    this.marketplaceGateway.emitOfferCreated(customerId, entity, request.title);

    return entity;
  }

  /**
   * Retrieves a paginated list of offers for a specific service request.
   */
  async findOffersByRequest(
    requestId: string,
    query?: GetOffersQueryDto,
  ): Promise<PaginatedResponse<OfferEntity>> {
    if (!isValidObjectId(requestId)) {
      throw new BadRequestException('Invalid request ID format');
    }

    const request = await this.requestModel.findById(requestId).exec();
    if (!request) {
      throw new NotFoundException(`Service request with ID ${requestId} not found`);
    }

    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(Math.max(1, Number(query?.limit) || 20), 50);

    const filter: Record<string, any> = { requestId };
    if (query?.status) {
      filter.status = query.status;
    }

    const total = await this.offerModel.countDocuments(filter).exec();
    const docs = await this.offerModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    const data = docs.map((doc) => this.toEntity(doc));
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
   * Retrieves a single offer by ID.
   */
  async findOfferById(id: string): Promise<OfferEntity | null> {
    if (!isValidObjectId(id)) {
      return null;
    }

    const doc = await this.offerModel.findById(id).lean().exec();
    if (!doc) {
      return null;
    }

    return this.toEntity(doc);
  }

  /**
   * Customer accepts an offer with Two-Tier Concurrency Protection:
   *   Tier 1: Redis distributed lock (`mkt:lock:request:<requestId>`).
   *   Tier 2: Atomic MongoDB conditional update (`findOneAndUpdate({ _id: requestId, status: 'OPEN' })`).
   *
   * On success:
   *   - Winning offer marked ACCEPTED; peer offers marked REJECTED.
   *   - Emits `offer:accepted` to the winning provider's private room.
   *   - Emits `request:closed` to the shared `providers` room.
   *
   * Lock is safely released in finally block via atomic Lua script.
   * Socket delivery failure does NOT roll back the database transaction.
   */
  async acceptOffer(
    offerId: string,
    customerId: string,
  ): Promise<AcceptOfferResponse> {
    if (!isValidObjectId(offerId)) {
      throw new BadRequestException('Invalid offer ID format');
    }

    const offer = await this.offerModel.findById(offerId).exec();
    if (!offer) {
      throw new NotFoundException(`Offer with ID ${offerId} not found`);
    }

    if (offer.status !== 'PENDING') {
      throw new BadRequestException(
        `Offer is no longer pending (current status: '${offer.status}')`,
      );
    }

    const requestId = offer.requestId;
    const lockKey = `mkt:lock:request:${requestId}`;

    // Tier 1: Acquire Redis distributed lock
    const lockToken = await this.distributedLockService.acquire(lockKey, 10000);
    if (!lockToken) {
      this.logger.warn(
        `Concurrent acceptance rejected by Redis lock for request ${requestId}`,
      );
      throw new ConflictException(
        'Concurrent acceptance in progress for this request. Please retry.',
      );
    }

    try {
      // Verify request existence and customer ownership
      const request = await this.requestModel.findById(requestId).exec();
      if (!request) {
        throw new NotFoundException(`Service request with ID ${requestId} not found`);
      }

      if (request.customerId !== customerId) {
        throw new ForbiddenException(
          'You do not have permission to accept offers for this service request',
        );
      }

      if (request.status !== 'OPEN') {
        throw new ConflictException(
          `Service request is no longer OPEN for acceptance (status: '${request.status}')`,
        );
      }

      // Tier 2: Atomic MongoDB conditional mutation
      const updatedRequest = await this.requestModel
        .findOneAndUpdate(
          { _id: requestId, status: 'OPEN' },
          {
            $set: {
              status: 'ACCEPTED',
              acceptedOfferId: offerId,
            },
          },
          { new: true },
        )
        .exec();

      if (!updatedRequest) {
        this.logger.warn(
          `Atomic mutation conflict: request ${requestId} was already accepted`,
        );
        throw new ConflictException(
          'Service request has already been accepted by another transaction',
        );
      }

      // Transition winning offer to ACCEPTED
      const acceptedOfferDoc = await this.offerModel
        .findByIdAndUpdate(
          offerId,
          { $set: { status: 'ACCEPTED' } },
          { new: true },
        )
        .exec();

      // Transition peer offers on this request to REJECTED
      await this.offerModel
        .updateMany(
          {
            requestId,
            _id: { $ne: offerId },
            status: 'PENDING',
          },
          { $set: { status: 'REJECTED' } },
        )
        .exec();

      this.logger.log(
        `Offer ${offerId} accepted by customer ${customerId} for request ${requestId}. Peer offers rejected.`,
      );

      const acceptedEntity = this.toEntity(acceptedOfferDoc || offer);
      const providerId = offer.providerId.toString();

      // Automatically create / ensure conversation for the accepted request
      try {
        if (this.chatService) {
          await this.chatService.getOrCreateConversation(
            requestId.toString(),
            customerId.toString(),
            providerId,
          );
        }
      } catch (chatErr) {
        this.logger.warn(
          `Failed to auto-create conversation upon offer acceptance: ${chatErr}`,
        );
      }

      // Emit real-time events: offer:accepted to the winning provider, request:closed to providers room.
      // Both dispatches happen via Redis Pub/Sub adapter — at-least-once across cluster.
      this.marketplaceGateway.emitOfferAccepted(providerId, acceptedEntity, requestId.toString());

      return {
        success: true,
        offer: acceptedEntity,
        paymentPending: true,
      };
    } finally {
      // Always release the distributed lock safely via atomic Lua script
      await this.distributedLockService.release(lockKey, lockToken);
    }
  }
}
