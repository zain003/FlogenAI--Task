import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EnsureConversationDto {
  @IsNotEmpty({ message: 'requestId is required' })
  @IsString({ message: 'requestId must be a string' })
  requestId!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  providerId?: string;
}
