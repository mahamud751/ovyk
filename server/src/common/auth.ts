import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';

export const IS_PUBLIC = 'isPublic';
export const ROLES_KEY = 'roles';

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<T>(error: Error | null, user: T): T {
    if (error || !user) throw error || new UnauthorizedException('Sign in required');
    return user;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: { role: Role } }>();
    return !!request.user && roles.includes(request.user.role);
  }
}

export const STAFF: Role[] = [
  Role.ADMIN,
  Role.DISPATCHER,
  Role.SUPPORT,
  Role.EMERGENCY_RESPONDER,
  Role.FLEET_MANAGER,
  Role.FINANCE,
  Role.PARTNER_MANAGER,
];

export const EMERGENCY_STAFF: Role[] = [Role.ADMIN, Role.EMERGENCY_RESPONDER, Role.DISPATCHER];
