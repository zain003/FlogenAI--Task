import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Offer, OfferSchema } from './schemas/offer.schema';
import {
  ServiceRequest,
  ServiceRequestSchema,
} from '../requests/schemas/service-request.schema';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { AuthModule } from '../auth/auth.module';
import { RequestsModule } from '../requests/requests.module';
import { RedisModule } from '../redis/redis.module';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Offer.name, schema: OfferSchema },
      { name: ServiceRequest.name, schema: ServiceRequestSchema },
    ]),
    AuthModule,
    RequestsModule,
    RedisModule,
    // SocketModule provides MarketplaceGateway for real-time offer event dispatch
    SocketModule,
  ],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
