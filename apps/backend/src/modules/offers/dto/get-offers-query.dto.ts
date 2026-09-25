import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OfferStatus } from '../interfaces/offer.interface';

export class GetOffersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(50, { message: 'Limit cannot exceed 50 items per page' })
  limit?: number = 20;

  @IsOptional()
  @IsEnum(['PENDING', 'ACCEPTED', 'REJECTED'], {
    message: 'Status must be one of PENDING, ACCEPTED, REJECTED',
  })
  status?: OfferStatus;
}
