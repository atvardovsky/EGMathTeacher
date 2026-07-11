export type UserRole = 'admin' | 'student';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface TutorTask {
  title: string;
  prompt: string;
  difficulty?: string;
}

export interface TutorExample {
  title: string;
  explanation: string;
}

export interface TutorCitation {
  fileId: string;
  filename?: string;
  quote?: string;
}

export interface TutorAnswer {
  conversationId: string;
  answer: string;
  tasks: TutorTask[];
  examples: TutorExample[];
  needsImage: boolean;
  imagePrompt?: string;
  citations: TutorCitation[];
}

export interface TutorTurn {
  id: string;
  prompt: string;
  source: 'text' | 'voice';
  answer?: TutorAnswer;
  imageUrl?: string;
  loadingImage?: boolean;
}

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

export interface StudentProfile {
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
  profile: StudentProfile | null;
}

export interface KnowledgeFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  openaiFileId: string;
  vectorStoreId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeStatus {
  vectorStoreIds: string[];
  files: KnowledgeFile[];
}
