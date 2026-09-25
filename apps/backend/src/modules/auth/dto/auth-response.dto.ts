import { UserRole } from '../interfaces/user.interface';

export class AuthUserDto {
  id!: string;
  email!: string;
  name!: string;
  role!: UserRole;
}

export class AuthResponseDto {
  accessToken!: string;
  user!: AuthUserDto;
}
