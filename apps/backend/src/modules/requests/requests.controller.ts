import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import {
  GetRequestsQueryDto,
  GetCustomerRequestsQueryDto,
} from './dto/get-requests-query.dto';
import {
  ServiceRequestEntity,
  PaginatedResponse,
} from './interfaces/request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  /**
   * Creates a new service request (Customer role only)
   * POST /api/requests
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async create(
    @CurrentUser() user: any,
    @Body() createRequestDto: CreateRequestDto,
  ): Promise<ServiceRequestEntity> {
    const customerId = user.id || user.sub;
    return this.requestsService.create(customerId, createRequestDto);
  }

  /**
   * Retrieves paginated service requests authored by the authenticated customer
   * GET /api/requests/my-requests
   */
  @Get('my-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async getMyRequests(
    @CurrentUser() user: any,
    @Query() query: GetCustomerRequestsQueryDto,
  ): Promise<PaginatedResponse<ServiceRequestEntity>> {
    const customerId = user.id || user.sub;
    return this.requestsService.findByCustomer(customerId, query);
  }

  /**
   * Retrieves a single service request by ID
   * GET /api/requests/:id
   */
  @Get(':id')
  async getById(@Param('id') id: string): Promise<ServiceRequestEntity> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid request ID format');
    }

    const request = await this.requestsService.findById(id);
    if (!request) {
      throw new NotFoundException(`Service request with ID ${id} not found`);
    }

    return request;
  }

  /**
   * Retrieves a paginated list of service requests with optional status filtering
   * GET /api/requests
   */
  @Get()
  async getAll(
    @Query() query: GetRequestsQueryDto,
  ): Promise<PaginatedResponse<ServiceRequestEntity>> {
    return this.requestsService.findAll(query);
  }
}
