import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateMessageDto {
  @IsNotEmpty({ message: 'Message content cannot be empty' })
  @IsString({ message: 'Message content must be a string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1, { message: 'Message content cannot be empty' })
  @MaxLength(2000, { message: 'Message content cannot exceed 2000 characters' })
  content!: string;
}
