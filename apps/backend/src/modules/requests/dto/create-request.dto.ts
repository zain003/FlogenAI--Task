import { IsNumber, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateRequestDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'title must be a string' })
  @MinLength(3, { message: 'title must be at least 3 characters long' })
  @MaxLength(100, { message: 'title must not exceed 100 characters' })
  title!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'description must be a string' })
  @MinLength(10, { message: 'description must be at least 10 characters long' })
  @MaxLength(2000, { message: 'description must not exceed 2000 characters' })
  description!: string;

  @IsNumber({}, { message: 'budget must be a number' })
  @Min(1, { message: 'budget must be at least 1' })
  budget!: number;
}
