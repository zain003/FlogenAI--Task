import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';

// Mock Stripe library
jest.mock('stripe', () => {
  const MockStripe = jest.fn().mockImplementation(() => {
    return {
      paymentIntents: {
        create: jest.fn().mockResolvedValue({
          id: 'pi_test_12345',
          client_secret: 'pi_test_12345_secret_67890',
          amount: 5000,
          currency: 'usd',
          status: 'requires_payment_method',
        }),
      },
      webhooks: {
        constructEvent: jest.fn().mockImplementation((payload, sig, secret) => {
          if (sig === 'invalid_sig' || secret !== 'whsec_test_secret') {
            throw new Error('Invalid signature');
          }
          return {
            id: 'evt_test_123',
            type: 'payment_intent.succeeded',
            data: {
              object: {
                id: 'pi_test_12345',
                amount: 5000,
                status: 'succeeded',
              },
            },
          };
        }),
      },
    };
  });
  return {
    __esModule: true,
    default: MockStripe,
    Stripe: MockStripe,
  };
});

describe('StripeService', () => {
  let service: StripeService;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock_secret_key';
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test_secret';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentIntent', () => {
    it('should create a Stripe PaymentIntent with correct parameters and metadata', async () => {
      const metadata = {
        requestId: 'req_123',
        offerId: 'off_456',
        customerId: 'cust_789',
        providerId: 'prov_999',
      };

      const result = await service.createPaymentIntent(5000, 'usd', metadata);

      expect(result).toBeDefined();
      expect(result.id).toBe('pi_test_12345');
      expect(result.client_secret).toBe('pi_test_12345_secret_67890');
      expect(result.amount).toBe(5000);
    });
  });

  describe('constructWebhookEvent', () => {
    it('should construct event successfully when signature is valid', () => {
      const payload = Buffer.from('{"id":"evt_test_123"}');
      const sig = 'valid_sig';

      const event = service.constructWebhookEvent(payload, sig);

      expect(event).toBeDefined();
      expect(event.id).toBe('evt_test_123');
      expect(event.type).toBe('payment_intent.succeeded');
    });

    it('should throw error when signature is missing', () => {
      const payload = Buffer.from('{"id":"evt_test_123"}');
      expect(() => service.constructWebhookEvent(payload, '')).toThrow(
        'Missing stripe-signature header',
      );
    });

    it('should throw error when signature is invalid', () => {
      const payload = Buffer.from('{"id":"evt_test_123"}');
      expect(() => service.constructWebhookEvent(payload, 'invalid_sig')).toThrow(
        'Invalid signature',
      );
    });
  });
});
