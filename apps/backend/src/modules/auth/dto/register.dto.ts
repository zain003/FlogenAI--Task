import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../interfaces/user.interface';

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email should not be empty' })
  email!: string;

  @IsString({ message: 'password must be a string' })
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @IsNotEmpty({ message: 'password should not be empty' })
  password!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'name must be at least 2 characters long' })
  @IsNotEmpty({ message: 'name should not be empty' })
  name!: string;

  @IsEnum(['customer', 'provider'], {
    message: 'role must be either customer or provider',
  })
  @IsNotEmpty({ message: 'role should not be empty' })
  role!: UserRole;
}
