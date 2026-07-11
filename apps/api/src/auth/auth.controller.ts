import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './auth.types';

interface AuthRequestBody {
  name?: string;
  password?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() body: AuthRequestBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: unknown }> {
    const result = await this.authService.register(body);
    this.authService.attachSessionCookie(response, result.token);
    return { user: result.user };
  }

  @Post('login')
  async login(
    @Body() body: AuthRequestBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: unknown }> {
    const result = await this.authService.login(body);
    this.authService.attachSessionCookie(response, result.token);
    return { user: result.user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response): { status: 'ok' } {
    this.authService.clearSessionCookie(response);
    return { status: 'ok' };
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest): { user: unknown | null } {
    return { user: this.authService.getSessionFromRequest(request) ?? null };
  }
}
