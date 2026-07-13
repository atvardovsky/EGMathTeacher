import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { TutorService } from './tutor.service';
import type {
  LessonType,
  TutorAnswer,
  TutorLessonHistory,
  TutorLessonHistoryItem,
} from './tutor.types';

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
  turnId?: string;
  blockId?: string;
}

@Controller('tutor')
@UseGuards(AuthGuard)
export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  @Get('lessons')
  lessons(
    @Req() request: AuthenticatedRequest,
    @Query('limit') limit?: string,
    @Query('turnLimit') turnLimit?: string,
    @Query('scope') scope?: string,
  ): TutorLessonHistory {
    return this.tutorService.getLessonHistory({
      user: request.user!,
      limit,
      turnLimit,
      scope,
    });
  }

  @Post('lessons/:lessonSessionId/finish')
  finishLesson(
    @Req() request: AuthenticatedRequest,
    @Param('lessonSessionId') lessonSessionId: string,
  ): TutorLessonHistoryItem {
    return this.tutorService.finishLesson({
      user: request.user!,
      lessonSessionId,
    });
  }

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
      turnId: body.turnId,
      blockId: body.blockId,
    });
  }
}
