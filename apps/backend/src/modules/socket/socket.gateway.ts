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
import { OfferEntity } from '../offers/interfaces/offer.interface';

// ─── Typed Socket.IO Server-to-Client Event Interfaces ─────────────────────────

export interface OfferCreatedPayload {
  offer: OfferEntity;
  requestTitle: string;
}

export interface OfferAcceptedPayload {
  offer: OfferEntity;
  requestId: string;
}

export interface RequestClosedPayload {
  requestId: string;
}

// ─── Authenticated Socket User ───────────────────────────────────────────────

export interface AuthenticatedSocketUser {
  id: string;
  email: string;
  role: 'customer' | 'provider';
}

// ─── Gateway ─────────────────────────────────────────────────────────────────

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

  afterInit(_server: Server): void {
    this.logger.log('Marketplace Socket.IO Gateway initialized');
  }

  /**
   * Intercepts connection handshake, verifies JWT, and attaches user info.
   * - Providers automatically join the 'providers' broadcast room.
   * - All authenticated users auto-join their private room 'user:<userId>'.
   */
  async handleConnection(client: Socket): Promise<void> {
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

      // All authenticated users join their private user room for targeted events
      const privateRoom = `user:${user.id}`;
      client.join(privateRoom);
      this.logger.log(
        `Socket ${client.id} (${user.email}) joined private room '${privateRoom}'`,
      );

      // Providers additionally join the shared 'providers' broadcast room
      if (user.role === 'provider') {
        client.join('providers');
        this.logger.log(
          `Provider socket ${client.id} (${user.email}) joined 'providers' broadcast room`,
        );
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid token';
      this.logger.warn(`Connection rejected: ${errorMsg} (socket: ${client.id})`);
      client.emit('error', { message: 'Unauthorized: Invalid authentication token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Socket disconnected: ${client.id}`);
  }

  // ─── Event Dispatchers ──────────────────────────────────────────────────────

  /**
   * Broadcasts `request:created` to the shared `providers` room.
   * Called by RequestsService when a customer creates a new request.
   */
  emitRequestCreated(request: ServiceRequestEntity): void {
    if (this.server) {
      this.server.to('providers').emit('request:created', { request });
      this.logger.log(
        `Dispatched request:created for request ${request.id} → room 'providers'`,
      );
    }
  }

  /**
   * Dispatches `offer:created` to the customer's private room.
   * Called by OffersService when a provider submits an offer.
   * Guarantees delivery across cluster nodes via the Redis Pub/Sub adapter.
   *
   * @param customerId - The ID of the customer who owns the request.
   * @param offer      - The newly created offer entity.
   * @param requestTitle - The title of the parent service request.
   */
  emitOfferCreated(customerId: string, offer: OfferEntity, requestTitle: string): void {
    if (this.server) {
      const room = `user:${customerId}`;
      const payload: OfferCreatedPayload = { offer, requestTitle };
      this.server.to(room).emit('offer:created', payload);
      this.logger.log(
        `Dispatched offer:created for offer ${offer.id} → room '${room}' (customer: ${customerId})`,
      );
    }
  }

  /**
   * Dispatches `offer:accepted` to the winning provider's private room and
   * broadcasts `request:closed` to the shared `providers` room so all
   * providers can remove/disable the now-closed request from their feed.
   *
   * @param providerId - The ID of the winning provider.
   * @param offer      - The accepted offer entity.
   * @param requestId  - The ID of the closed service request.
   */
  emitOfferAccepted(providerId: string, offer: OfferEntity, requestId: string): void {
    if (this.server) {
      // Notify the winning provider via their private room
      const providerRoom = `user:${providerId}`;
      const acceptedPayload: OfferAcceptedPayload = { offer, requestId };
      this.server.to(providerRoom).emit('offer:accepted', acceptedPayload);
      this.logger.log(
        `Dispatched offer:accepted for offer ${offer.id} → room '${providerRoom}' (provider: ${providerId})`,
      );

      // Broadcast request closure to all providers so they can update their feed
      const closedPayload: RequestClosedPayload = { requestId };
      this.server.to('providers').emit('request:closed', closedPayload);
      this.logger.log(
        `Dispatched request:closed for request ${requestId} → room 'providers'`,
      );
    }
  }
}
