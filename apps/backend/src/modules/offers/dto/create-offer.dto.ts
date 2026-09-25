import {
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateOfferDto {
  @IsNumber({}, { message: 'Price must be a valid number' })
  @IsPositive({ message: 'Price must be a positive number' })
  @Min(1, { message: 'Price must be at least 1' })
  price!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Message must be a string' })
  @MinLength(5, { message: 'Message must be at least 5 characters long' })
  @MaxLength(1000, { message: 'Message cannot exceed 1000 characters' })
  message!: string;
}
