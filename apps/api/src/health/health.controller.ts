import { Controller, Get } from '@nestjs/common';
import { OpenAiRealtimeBridgeService } from '../webrtc/openai-realtime-bridge.service';

@Controller('health')
export class HealthController {
  constructor(private readonly bridge: OpenAiRealtimeBridgeService) {}

  @Get()
  getHealth(): {
    status: 'ok' | 'degraded';
    audio: { supported: boolean; reason?: string };
  } {
    const audio = this.bridge.getAudioSupportStatus();
    const status = audio.supported ? 'ok' : 'degraded';
    return {
      status,
      audio,
    };
  }
}
