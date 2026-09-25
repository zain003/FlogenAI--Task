import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email should not be empty' })
  email!: string;

  @IsString({ message: 'password must be a string' })
  @IsNotEmpty({ message: 'password should not be empty' })
  password!: string;
}
