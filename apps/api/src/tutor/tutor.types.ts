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
