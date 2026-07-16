import type { LessonType, TutorAnswer, TutorLessonHistoryTurn } from '../tutor/tutor.types';

export type WebRtcLessonClientEvent =
  | {
      type: 'client_ready';
    }
  | {
      type: 'heartbeat';
      sentAt?: number;
    }
  | {
      type: 'student_text';
      requestId?: string;
      message?: string;
      lessonType?: LessonType;
      source?: 'text' | 'voice';
      origin?: 'client_data_channel' | 'realtime_transcript';
    };

export type WebRtcLessonServerEvent =
  | {
      type: 'session_ready';
      sessionId: string;
      conversationId: string;
      lessonSessionId?: string;
      lessonType?: LessonType;
    }
  | {
      type: 'heartbeat_ack';
      sessionId: string;
      receivedAt: number;
    }
  | {
      type: 'tutor_answer';
      requestId?: string;
      turn: TutorLessonHistoryTurn;
      answer: TutorAnswer;
      conversationId: string;
      lessonSessionId: string;
      lessonType: LessonType;
      terminal: boolean;
    }
  | {
      type: 'error';
      requestId?: string;
      code?: string;
      message: string;
    };
