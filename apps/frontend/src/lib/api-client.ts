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
}

export const apiClient = new ApiClient();
