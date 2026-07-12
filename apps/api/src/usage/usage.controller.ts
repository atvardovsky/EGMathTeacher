import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { UsageService } from './usage.service';
import { UserUsageSummary } from './usage.types';

@Controller('usage')
@UseGuards(AuthGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get('me/summary')
  summary(
    @Req() request: AuthenticatedRequest,
    @Query('lessonSessionId') lessonSessionId?: string,
  ): UserUsageSummary {
    return this.usageService.getUserSummary(request.user!.id, lessonSessionId);
  }
}
