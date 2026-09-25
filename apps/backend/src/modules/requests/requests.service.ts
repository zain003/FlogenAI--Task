import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import {
  ServiceRequest,
  ServiceRequestDocument,
} from './schemas/service-request.schema';
import { CreateRequestDto } from './dto/create-request.dto';
import {
  GetRequestsQueryDto,
  GetCustomerRequestsQueryDto,
} from './dto/get-requests-query.dto';
import {
  ServiceRequestEntity,
  PaginatedResponse,
} from './interfaces/request.interface';
import { MarketplaceGateway } from '../socket/socket.gateway';

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectModel(ServiceRequest.name)
    private readonly requestModel: Model<ServiceRequestDocument>,
    @Optional()
    private readonly marketplaceGateway?: MarketplaceGateway,
  ) {}

  /**
   * Helper function to map raw/lean Mongoose documents to ServiceRequestEntity
   */
  private toEntity(doc: any): ServiceRequestEntity {
    return {
      id: doc._id ? doc._id.toString() : doc.id || '',
      title: doc.title,
      description: doc.description,
      budget: doc.budget,
      status: doc.status,
      customerId: doc.customerId,
      acceptedOfferId: doc.acceptedOfferId ?? null,
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
   * Creates a new service request authored by the authenticated customer
   */
  async create(
    customerId: string,
    createRequestDto: CreateRequestDto,
  ): Promise<ServiceRequestEntity> {
    const createdRequest = new this.requestModel({
      title: createRequestDto.title.trim(),
      description: createRequestDto.description.trim(),
      budget: createRequestDto.budget,
      status: 'OPEN',
      customerId,
      acceptedOfferId: null,
    });

    const savedDoc = await createdRequest.save();
    const entity = this.toEntity(savedDoc);

    this.logger.log(
      `Created service request ${entity.id} for customer ${customerId} with budget $${entity.budget}`,
    );

    if (this.marketplaceGateway) {
      this.marketplaceGateway.emitRequestCreated(entity);
    }

    return entity;
  }

  /**
   * Returns a paginated feed of service requests with optional status filtering
   * Enforces a hard limit cap of 50 per query
   */
  async findAll(
    query?: GetRequestsQueryDto,
  ): Promise<PaginatedResponse<ServiceRequestEntity>> {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(Math.max(1, Number(query?.limit) || 20), 50);

    const filter: Record<string, any> = {};
    if (query?.status) {
      filter.status = query.status;
    }

    const total = await this.requestModel.countDocuments(filter).exec();
    const docs = await this.requestModel
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
   * Returns paginated service requests created by a specific customer
   * Enforces customer ownership and a hard limit cap of 50
   */
  async findByCustomer(
    customerId: string,
    query?: GetCustomerRequestsQueryDto,
  ): Promise<PaginatedResponse<ServiceRequestEntity>> {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(Math.max(1, Number(query?.limit) || 20), 50);

    const filter = { customerId };
    const total = await this.requestModel.countDocuments(filter).exec();
    const docs = await this.requestModel
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
   * Finds a service request by ID
   */
  async findById(id: string): Promise<ServiceRequestEntity | null> {
    if (!isValidObjectId(id)) {
      return null;
    }

    const doc = await this.requestModel.findById(id).lean().exec();
    if (!doc) {
      return null;
    }

    return this.toEntity(doc);
  }
}
