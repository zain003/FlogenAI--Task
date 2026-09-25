import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

describe('RolesGuard (Unit Tests)', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockContext(user: any): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access if no roles are required on the route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext({ id: '1', role: 'customer' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if user has the required customer role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['customer']);

    const context = createMockContext({ id: '1', role: 'customer' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if user has provider role and provider is allowed', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['customer', 'provider']);

    const context = createMockContext({ id: '2', role: 'provider' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException if user has role provider but route requires customer', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['customer']);

    const context = createMockContext({ id: '2', role: 'provider' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if request has no authenticated user', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['customer']);

    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
