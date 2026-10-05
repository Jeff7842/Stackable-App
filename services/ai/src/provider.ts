export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type CompletionPurpose = "hint" | "rewrite" | "practice" | "flashcards" | "summary" | "quiz";

export interface CompleteInput {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  /** Lets the fake provider pick a scripted reply; real providers ignore it. */
  purpose?: CompletionPurpose;
}

export interface Completion {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface AiProvider {
  readonly name: string;
  /** False when the provider is configured off (for example a missing API key). */
  readonly enabled: boolean;
  complete(input: CompleteInput): Promise<Completion>;
}

/** A provider call failed; the service turns this into a friendly 502. */
export class ProviderError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}
