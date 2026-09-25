import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { isValidObjectId } from 'mongoose';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { GetOffersQueryDto } from './dto/get-offers-query.dto';
import {
  AcceptOfferResponse,
  OfferEntity,
  PaginatedResponse,
} from './interfaces/offer.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  /**
   * Provider submits an offer against an OPEN service request.
   * POST /api/requests/:id/offers
   */
  @Post('requests/:id/offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('provider')
  @HttpCode(HttpStatus.CREATED)
  async createOffer(
    @Param('id') requestId: string,
    @CurrentUser() user: any,
    @Body() createOfferDto: CreateOfferDto,
  ): Promise<OfferEntity> {
    if (!isValidObjectId(requestId)) {
      throw new BadRequestException('Invalid request ID format');
    }
    const providerId = user.id || user.sub;
    return this.offersService.createOffer(requestId, providerId, createOfferDto);
  }

  /**
   * Retrieves a paginated list of offers for a specific service request.
   * GET /api/requests/:id/offers
   */
  @Get('requests/:id/offers')
  async getOffersByRequest(
    @Param('id') requestId: string,
    @Query() query: GetOffersQueryDto,
  ): Promise<PaginatedResponse<OfferEntity>> {
    if (!isValidObjectId(requestId)) {
      throw new BadRequestException('Invalid request ID format');
    }
    return this.offersService.findOffersByRequest(requestId, query);
  }

  /**
   * Customer accepts an offer with distributed lock & atomic conditional protection.
   * POST /api/offers/:id/accept
   */
  @Post('offers/:id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @HttpCode(HttpStatus.OK)
  async acceptOffer(
    @Param('id') offerId: string,
    @CurrentUser() user: any,
  ): Promise<AcceptOfferResponse> {
    if (!isValidObjectId(offerId)) {
      throw new BadRequestException('Invalid offer ID format');
    }
    const customerId = user.id || user.sub;
    return this.offersService.acceptOffer(offerId, customerId);
  }

  /**
   * Retrieves a single offer by ID.
   * GET /api/offers/:id
   */
  @Get('offers/:id')
  async getOfferById(@Param('id') id: string): Promise<OfferEntity> {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid offer ID format');
    }
    const offer = await this.offersService.findOfferById(id);
    if (!offer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }
    return offer;
  }
}
