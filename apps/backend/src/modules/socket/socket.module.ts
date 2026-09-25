import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MarketplaceGateway } from './socket.gateway';
import { ChatGateway } from './chat.gateway';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is missing');
        }
        return { secret };
      },
    }),
    ChatModule,
  ],
  providers: [MarketplaceGateway, ChatGateway],
  exports: [MarketplaceGateway, ChatGateway],
})
export class SocketModule {}
