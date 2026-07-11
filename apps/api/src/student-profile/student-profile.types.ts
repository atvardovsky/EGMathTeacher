import { AuthSession } from '../auth/auth.types';

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
  aiSummary: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfileStatus {
  onboardingRequired: boolean;
  profile: StudentProfileDto | null;
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
}
