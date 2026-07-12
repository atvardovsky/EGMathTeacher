import type { LessonType } from '../tutor/tutor.types';

export type BackgroundAiJobType =
  | 'learning_signal_extraction'
  | 'learning_window_analysis'
  | 'session_summary'
  | 'student_profile_refresh'
  | 'profile_strategy_refresh'
  | 'teaching_strategy_refresh'
  | 'tutor_quality_review';

export type BackgroundAiJobStatus = 'pending' | 'running' | 'succeeded' | 'failed';
export type BackgroundLearningObservationStatus = 'pending' | 'queued' | 'processed';

export interface BackgroundAiJobRecord {
  id: string;
  type: BackgroundAiJobType;
  status: BackgroundAiJobStatus;
  user_id: string;
  conversation_id: string | null;
  attempts: number;
  payload_json: string;
  result_json: string | null;
  error_message: string | null;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TutorTurnBackgroundInput {
  userId: string;
  userName: string;
  conversationId: string;
  lessonSessionId?: string;
  lessonType: LessonType;
  source: 'text' | 'voice';
  prompt: string;
  answer: {
    answer: string;
    tasksCount: number;
    examplesCount: number;
    citationsCount: number;
    needsImage: boolean;
    goalStatus?: string;
    shouldStop?: boolean;
  };
}

export interface BackgroundAiStatus {
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
}

export interface BackgroundLearningObservationRecord {
  id: string;
  user_id: string;
  conversation_id: string;
  lesson_type: LessonType;
  source: 'text' | 'voice';
  observation_json: string;
  status: BackgroundLearningObservationStatus;
  window_id: string | null;
  created_at: string;
  updated_at: string;
}
