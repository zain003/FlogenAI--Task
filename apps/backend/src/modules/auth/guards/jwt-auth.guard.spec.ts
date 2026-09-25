import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard (Unit Tests)', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('should return user if user exists and no error', () => {
    const mockUser = { id: 'user-1', email: 'test@test.com', role: 'customer' };
    const result = guard.handleRequest(null, mockUser, null, {} as ExecutionContext);
    expect(result).toBe(mockUser);
  });

  it('should throw UnauthorizedException if error is provided', () => {
    const error = new Error('Token expired');
    expect(() =>
      guard.handleRequest(error, null, null, {} as ExecutionContext),
    ).toThrow(error);
  });

  it('should throw UnauthorizedException if user is missing', () => {
    expect(() =>
      guard.handleRequest(null, null, { message: 'jwt expired' }, {} as ExecutionContext),
    ).toThrow(UnauthorizedException);
  });
});
