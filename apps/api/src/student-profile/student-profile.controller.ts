import { Body, Controller, Get, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { StudentProfileService } from './student-profile.service';
import {
  StudentMeetingReadiness,
  StudentOnboardingAnswers,
  StudentProfileStatus,
} from './student-profile.types';

@Controller('student-profile')
@UseGuards(AuthGuard)
export class StudentProfileController {
  constructor(private readonly studentProfileService: StudentProfileService) {}

  @Get('me')
  me(@Req() request: AuthenticatedRequest): StudentProfileStatus {
    return this.studentProfileService.getStatus(request.user!);
  }

  @Get('me/meeting-readiness')
  meetingReadiness(
    @Req() request: AuthenticatedRequest,
    @Query('conversationId') conversationId?: string,
  ): StudentMeetingReadiness {
    return this.studentProfileService.getMeetingReadiness(request.user!, conversationId);
  }

  @Put('me')
  async completeOnboarding(
    @Req() request: AuthenticatedRequest,
    @Body() body: StudentOnboardingAnswers,
  ): Promise<StudentProfileStatus> {
    return this.studentProfileService.completeOnboarding({
      user: request.user!,
      answers: body,
    });
  }

  @Post('me/from-conversation')
  async completeOnboardingFromConversation(
    @Req() request: AuthenticatedRequest,
    @Body() body: { conversationId?: string },
  ): Promise<StudentProfileStatus> {
    return this.studentProfileService.completeOnboardingFromConversation({
      user: request.user!,
      conversationId: body?.conversationId,
    });
  }
}
