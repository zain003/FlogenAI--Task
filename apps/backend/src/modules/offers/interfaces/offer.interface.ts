export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface OfferEntity {
  id: string;
  requestId: string;
  providerId: string;
  price: number;
  message: string;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptOfferResponse {
  success: boolean;
  offer: OfferEntity;
  paymentPending: boolean;
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
