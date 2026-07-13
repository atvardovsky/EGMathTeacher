import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { BackgroundAiService } from './background-ai.service';
import { BackgroundAiJobType } from './background-ai.types';

interface RecoverBackgroundJobsBody {
  limit?: number;
  conversationId?: string;
  type?: BackgroundAiJobType;
}

@Controller('usage')
@UseGuards(AuthGuard)
export class BackgroundAiController {
  constructor(private readonly backgroundAiService: BackgroundAiService) {}

  @Post('me/background/recover')
  recoverBackgroundJobs(
    @Req() request: AuthenticatedRequest,
    @Body() body: RecoverBackgroundJobsBody,
  ): { requeued: number; jobIds: string[] } {
    return this.backgroundAiService.requeueFailedJobsForUser({
      userId: request.user!.id,
      limit: body.limit,
      conversationId: body.conversationId,
      type: body.type,
    });
  }
}
