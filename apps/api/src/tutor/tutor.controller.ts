import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { TutorService } from './tutor.service';
import { TutorAnswer } from './tutor.types';

interface TutorMessageBody {
  message?: string;
  conversationId?: string;
  source?: 'text' | 'voice';
}

interface TutorImageBody {
  prompt?: string;
  context?: string;
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
      source: body.source ?? 'text',
    });
  }

  @Post('image')
  async image(@Body() body: TutorImageBody): Promise<unknown> {
    return this.tutorService.generateImage({
      prompt: body.prompt,
      context: body.context,
    });
  }
}
