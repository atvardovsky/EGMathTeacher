import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { TutorService } from './tutor.service';
import type { LessonType, TutorAnswer } from './tutor.types';

interface TutorMessageBody {
  message?: string;
  conversationId?: string;
  requestId?: string;
  source?: 'text' | 'voice';
  lessonType?: LessonType;
}

interface TutorImageBody {
  prompt?: string;
  context?: string;
  conversationId?: string;
  lessonSessionId?: string;
  lessonType?: LessonType;
}

@Controller('tutor')
@UseGuards(AuthGuard)
export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  @Post('message')
  async message(
    @Req() request: AuthenticatedRequest,
    @Body() body: TutorMessageBody,
  ): Promise<TutorAnswer> {
    return this.tutorService.answerMessage({
      user: request.user!,
      message: body.message,
      conversationId: body.conversationId,
      requestId: body.requestId,
      source: body.source ?? 'text',
      lessonType: body.lessonType,
    });
  }

  @Post('image')
  async image(
    @Req() request: AuthenticatedRequest,
    @Body() body: TutorImageBody,
  ): Promise<unknown> {
    return this.tutorService.generateImage({
      user: request.user!,
      prompt: body.prompt,
      context: body.context,
      conversationId: body.conversationId,
      lessonSessionId: body.lessonSessionId,
      lessonType: body.lessonType,
    });
  }
}
