export type UserRole = 'customer' | 'provider';

export interface UserEntity {
  id: string;
  email: string;
  passwordHash?: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}
