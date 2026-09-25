import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ServiceRequestEntity } from '../requests/interfaces/request.interface';

export interface AuthenticatedSocketUser {
  id: string;
  email: string;
  role: 'customer' | 'provider';
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class MarketplaceGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MarketplaceGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Marketplace Socket.IO Gateway initialized');
  }

  /**
   * Intercepts connection handshake, verifies JWT, and attaches user info
   * Providers automatically join the 'providers' room
   */
  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake?.auth?.token ||
        (client.handshake?.headers?.authorization
          ? client.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : null);

      if (!token) {
        this.logger.warn(`Connection rejected: Missing auth token (socket: ${client.id})`);
        client.emit('error', { message: 'Authentication token required' });
        client.disconnect(true);
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret });

      if (!payload || (!payload.sub && !payload.id) || !payload.role) {
        throw new Error('Malformed token payload');
      }

      const user: AuthenticatedSocketUser = {
        id: payload.sub || payload.id,
        email: payload.email,
        role: payload.role,
      };

      client.data.user = user;

      // Auto-join providers to the dedicated 'providers' broadcast room
      if (user.role === 'provider') {
        client.join('providers');
        this.logger.log(
          `Provider connected and joined 'providers' room: ${client.id} (${user.email})`,
        );
      } else {
        this.logger.log(
          `Customer connected: ${client.id} (${user.email})`,
        );
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid token';
      this.logger.warn(`Connection rejected: ${errorMsg} (socket: ${client.id})`);
      client.emit('error', { message: 'Unauthorized: Invalid authentication token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  /**
   * Broadcasts request:created event to the 'providers' room
   */
  emitRequestCreated(request: ServiceRequestEntity): void {
    if (this.server) {
      this.server.to('providers').emit('request:created', { request });
      this.logger.log(
        `Dispatched request:created event for request ${request.id} to room 'providers'`,
      );
    }
  }
}
