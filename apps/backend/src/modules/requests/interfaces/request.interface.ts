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
  updatedAt: string;
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
