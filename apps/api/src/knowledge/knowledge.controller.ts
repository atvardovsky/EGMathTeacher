import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../auth/auth.guard';
import { KnowledgeService } from './knowledge.service';

@Controller('admin/knowledge')
@UseGuards(AdminGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('files')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 25 * 1024 * 1024,
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File): Promise<unknown> {
    return {
      file: await this.knowledgeService.uploadKnowledgeFile(file),
    };
  }

  @Get('status')
  async getStatus(): Promise<unknown> {
    return this.knowledgeService.getStatus();
  }
}
