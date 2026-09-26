export type UserRole = 'customer' | 'provider';

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
}

export interface UserEntity {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export type RequestStatus = 'OPEN' | 'ACCEPTED' | 'PAID' | 'COMPLETED' | 'CANCELLED';

export interface ServiceRequestEntity {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: RequestStatus;
  customerId: string;
  acceptedOfferId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateRequestDto {
  title: string;
  description: string;
  budget: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GetRequestsQuery {
  page?: number;
  limit?: number;
  status?: RequestStatus;
}

export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface OfferEntity {
  id: string;
  requestId: string;
  providerId: string;
  price: number;
  message: string;
  status: OfferStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateOfferDto {
  price: number;
  message: string;
}

export interface AcceptOfferResponse {
  success: boolean;
  offer: OfferEntity;
  paymentPending: boolean;
}

export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

export interface PaymentEntity {
  id: string;
  requestId: string;
  offerId: string;
  customerId: string;
  providerId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  stripePaymentIntentId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PaymentIntentResponseDto {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

export interface CreatePaymentIntentDto {
  offerId: string;
}

export interface ConversationEntity {
  id: string;
  requestId: string;
  customerId: string;
  providerId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MessageEntity {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export function formatCurrency(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatRelativeDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateString;
  }
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  errors?: string[];
  timestamp: string;
  path: string;
}

export class ApiClientError extends Error {
  public statusCode: number;
  public errors?: string[];

  constructor(message: string, statusCode: number, errors?: string[]) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

const TOKEN_KEY = 'auth_token';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(TOKEN_KEY);
    }
  }

  public setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  }

  public getToken(): string | null {
    if (typeof window !== 'undefined') {
      return this.token || localStorage.getItem(TOKEN_KEY);
    }
    return this.token;
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network request failed';
      throw new ApiClientError(msg, 0);
    }

    if (!response.ok) {
      let errorBody: Partial<ApiErrorResponse> = {};
      try {
        errorBody = await response.json();
      } catch {
        errorBody = { message: response.statusText || 'An unexpected error occurred' };
      }

      const errorMessage =
        (Array.isArray(errorBody.errors) && errorBody.errors.length > 0)
          ? errorBody.errors[0]
          : errorBody.message || `Request failed with status ${response.status}`;

      throw new ApiClientError(errorMessage, response.status, errorBody.errors);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  public auth = {
    register: (dto: RegisterDto): Promise<AuthResponseDto> => {
      return this.request<AuthResponseDto>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
    },

    login: (dto: LoginDto): Promise<AuthResponseDto> => {
      return this.request<AuthResponseDto>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
    },

    getMe: (token?: string): Promise<UserEntity> => {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      return this.request<UserEntity>('/api/auth/me', {
        method: 'GET',
        headers,
      });
    },
  };

  public requests = {
    create: (dto: CreateRequestDto): Promise<ServiceRequestEntity> => {
      return this.request<ServiceRequestEntity>('/api/requests', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
    },

    getMyRequests: (params?: { page?: number; limit?: number }): Promise<PaginatedResponse<ServiceRequestEntity>> => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return this.request<PaginatedResponse<ServiceRequestEntity>>(`/api/requests/my-requests${query}`, {
        method: 'GET',
      });
    },

    getAll: (params?: GetRequestsQuery): Promise<PaginatedResponse<ServiceRequestEntity>> => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.status) searchParams.set('status', params.status);
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return this.request<PaginatedResponse<ServiceRequestEntity>>(`/api/requests${query}`, {
        method: 'GET',
      });
    },

    getById: (id: string): Promise<ServiceRequestEntity> => {
      return this.request<ServiceRequestEntity>(`/api/requests/${id}`, {
        method: 'GET',
      });
    },
  };

  public offers = {
    create: (requestId: string, dto: CreateOfferDto): Promise<OfferEntity> => {
      return this.request<OfferEntity>(`/api/requests/${requestId}/offers`, {
        method: 'POST',
        body: JSON.stringify(dto),
      });
    },

    getByRequestId: (
      requestId: string,
      params?: { page?: number; limit?: number; status?: OfferStatus },
    ): Promise<PaginatedResponse<OfferEntity>> => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.status) searchParams.set('status', params.status);
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return this.request<PaginatedResponse<OfferEntity>>(
        `/api/requests/${requestId}/offers${query}`,
        {
          method: 'GET',
        },
      );
    },

    accept: (offerId: string): Promise<AcceptOfferResponse> => {
      return this.request<AcceptOfferResponse>(`/api/offers/${offerId}/accept`, {
        method: 'POST',
      });
    },

    getById: (offerId: string): Promise<OfferEntity> => {
      return this.request<OfferEntity>(`/api/offers/${offerId}`, {
        method: 'GET',
      });
    },
  };

  public payments = {
    createIntent: (dto: CreatePaymentIntentDto): Promise<PaymentIntentResponseDto> => {
      return this.request<PaymentIntentResponseDto>('/api/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify(dto),
      });
    },

    getByRequestId: (requestId: string): Promise<PaymentEntity> => {
      return this.request<PaymentEntity>(`/api/payments/by-request/${requestId}`, {
        method: 'GET',
      });
    },

    simulateSuccess: (paymentIntentId: string): Promise<{ success: boolean; status: string }> => {
      return this.request<{ success: boolean; status: string }>('/api/payments/simulate-success', {
        method: 'POST',
        body: JSON.stringify({ paymentIntentId }),
      });
    },
  };

  public conversations = {
    getByRequestId: (requestId: string): Promise<ConversationEntity> => {
      return this.request<ConversationEntity>(
        `/api/conversations/by-request/${requestId}`,
        {
          method: 'GET',
        },
      );
    },

    getMessages: (
      conversationId: string,
      params?: { page?: number; limit?: number },
    ): Promise<PaginatedResponse<MessageEntity>> => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return this.request<PaginatedResponse<MessageEntity>>(
        `/api/conversations/${conversationId}/messages${query}`,
        {
          method: 'GET',
        },
      );
    },

    sendMessage: (
      conversationId: string,
      content: string,
    ): Promise<MessageEntity> => {
      return this.request<MessageEntity>(
        `/api/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content }),
        },
      );
    },

    ensure: (requestId: string): Promise<ConversationEntity> => {
      return this.request<ConversationEntity>('/api/conversations/ensure', {
        method: 'POST',
        body: JSON.stringify({ requestId }),
      });
    },
  };
}

export const apiClient = new ApiClient();
