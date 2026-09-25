'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  apiClient,
  AuthResponseDto,
  LoginDto,
  RegisterDto,
  UserEntity,
  UserRole,
} from '@/lib/api-client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (dto: LoginDto) => Promise<AuthResponseDto>;
  register: (dto: RegisterDto) => Promise<AuthResponseDto>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const handleAuthSuccess = useCallback(
    (response: AuthResponseDto) => {
      const { accessToken, user: authUser } = response;
      setTokenState(accessToken);
      setUser(authUser);
      apiClient.setToken(accessToken);

      if (authUser.role === 'customer') {
        router.push('/customer/requests');
      } else if (authUser.role === 'provider') {
        router.push('/provider/browse');
      }
    },
    [router]
  );

  const logout = useCallback(() => {
    setUser(null);
    setTokenState(null);
    apiClient.setToken(null);
    router.push('/login');
  }, [router]);

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      const storedToken = apiClient.getToken();
      if (!storedToken) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        setTokenState(storedToken);
        const profile: UserEntity = await apiClient.auth.getMe(storedToken);
        if (isMounted) {
          setUser({
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role,
          });
        }
      } catch {
        // Expired or malformed token in localStorage - reset storage cleanly
        apiClient.setToken(null);
        if (isMounted) {
          setUser(null);
          setTokenState(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(
    async (dto: LoginDto): Promise<AuthResponseDto> => {
      const response = await apiClient.auth.login(dto);
      handleAuthSuccess(response);
      return response;
    },
    [handleAuthSuccess]
  );

  const register = useCallback(
    async (dto: RegisterDto): Promise<AuthResponseDto> => {
      const response = await apiClient.auth.register(dto);
      handleAuthSuccess(response);
      return response;
    },
    [handleAuthSuccess]
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!user && !!token,
      login,
      register,
      logout,
    }),
    [user, token, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
  login: async () => {
    throw new Error('useAuth must be used within an AuthProvider');
  },
  register: async () => {
    throw new Error('useAuth must be used within an AuthProvider');
  },
  logout: () => {},
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  return context || defaultAuthContext;
}
