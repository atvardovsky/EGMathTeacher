import { AuthSession } from '../auth/auth.types';
import type { LessonType } from '../tutor/tutor.types';

export interface DiagnosticAnswer {
  prompt: string;
  answer: string;
}

export interface StudentOnboardingAnswers {
  exam?: string;
  grade?: string;
  examYear?: string;
  targetScore?: number;
  currentLevel?: string;
  confidence?: string;
  mathFeeling?: string;
  motivation?: string;
  weakTopics: string[];
  explanationStyle?: string;
  pacing?: string;
  visualPreference?: boolean;
  hintPreference?: string;
  practicePreference?: string;
  feedbackStyle?: string;
  analogyInterests: string[];
  diagnosticAnswers: DiagnosticAnswer[];
  freeform?: string;
}

export interface StudentProfileDto {
  userId: string;
  onboardingCompletedAt: string;
  onboardingAnswers: StudentOnboardingAnswers;
  knowledgeState: Record<string, unknown>;
  learningPreferences: Record<string, unknown>;
  psychologicalProfile: Record<string, unknown>;
  explanationStrategy: Record<string, unknown>;
  recentSessionSummaries: StudentSessionSummaryDto[];
  skillProgress: StudentSkillProgressDto[];
  aiSummary: string;
  createdAt: string;
  updatedAt: string;
}

export type SkillProgressDirection = 'progress' | 'regression' | 'stable' | 'unknown';
export type SkillProgressConfidence = 'low' | 'medium' | 'high' | 'unknown';
export type SkillSupportNeeded = 'none' | 'hint' | 'step_by_step' | 'full_explanation' | 'unknown';
export type SkillIndependence = 'low' | 'medium' | 'high' | 'unknown';

export interface StudentSessionSummaryDto {
  id: string;
  conversationId: string | null;
  lessonType: LessonType;
  summary: Record<string, unknown>;
  evidenceLevels: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StudentSkillProgressDto {
  id: string;
  conversationId: string | null;
  lessonType: LessonType;
  topic: string;
  skill: string;
  direction: SkillProgressDirection;
  confidence: SkillProgressConfidence;
  supportNeeded: SkillSupportNeeded;
  independence: SkillIndependence;
  evidence: Record<string, unknown>;
  createdAt: string;
}

export interface StudentProfileStatus {
  onboardingRequired: boolean;
  profile: StudentProfileDto | null;
}

export type StudentMeetingSignal =
  | 'preparation_goal'
  | 'self_assessment'
  | 'weak_topic'
  | 'explanation_preference'
  | 'diagnostic_or_contentful_reply';

export interface StudentMeetingReadiness {
  conversationId?: string;
  lessonSessionId?: string;
  canCreateProfile: boolean;
  score: number;
  tutorTurnCount: number;
  meaningfulStudentTurnCount: number;
  presentSignals: StudentMeetingSignal[];
  missingSignals: StudentMeetingSignal[];
  requiredSignals: StudentMeetingSignal[];
}

export interface StudentProfileRecord {
  user_id: string;
  onboarding_completed_at: string;
  onboarding_answers_json: string;
  knowledge_state_json: string;
  learning_preferences_json: string;
  psychological_profile_json: string;
  explanation_strategy_json: string;
  ai_summary: string;
  created_at: string;
  updated_at: string;
}

export interface StudentProfileRequestContext {
  user: AuthSession;
  answers: StudentOnboardingAnswers;
  conversationId?: string;
  lessonSessionId?: string;
  lessonType?: LessonType;
}

export interface StudentProfileConversationContext {
  user: AuthSession;
  conversationId?: string;
}
