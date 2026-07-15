import type { LessonType } from '../tutor/tutor.types';

export interface RealtimeTeachingContext {
  prompt: string;
  reviewContext: Record<string, unknown>;
  lessonSessionId?: string;
  lessonType?: LessonType;
}
