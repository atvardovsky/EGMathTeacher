import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = this.authService.getSessionFromRequest(request);
    if (!session) {
      throw new UnauthorizedException('Authentication required');
    }
    request.user = session;
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = this.authService.getSessionFromRequest(request);
    if (!session) {
      throw new UnauthorizedException('Authentication required');
    }
    if (session.role !== 'admin') {
      throw new UnauthorizedException('Admin access required');
    }
    request.user = session;
    return true;
  }
}
