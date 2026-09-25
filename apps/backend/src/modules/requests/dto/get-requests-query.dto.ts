import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { RequestStatus } from '../interfaces/request.interface';

export class GetRequestsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Transform(({ value }) => {
    const val = Number(value);
    if (isNaN(val)) return 20;
    if (val > 50) return 50;
    if (val < 1) return 1;
    return val;
  })
  limit?: number = 20;

  @IsOptional()
  @IsEnum(['OPEN', 'ACCEPTED', 'PAID', 'COMPLETED', 'CANCELLED'], {
    message: 'status must be a valid RequestStatus (OPEN, ACCEPTED, PAID, COMPLETED, CANCELLED)',
  })
  status?: RequestStatus;
}

export class GetCustomerRequestsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Transform(({ value }) => {
    const val = Number(value);
    if (isNaN(val)) return 20;
    if (val > 50) return 50;
    if (val < 1) return 1;
    return val;
  })
  limit?: number = 20;
}
