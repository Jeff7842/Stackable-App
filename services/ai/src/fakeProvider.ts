import { ProviderError, type AiProvider, type CompleteInput, type Completion } from "./provider";

export type Script = string | ((input: CompleteInput) => string);

const FAKE_PRACTICE_COUNT = 10; // more than any policy asks for; the service takes the first N

function defaultReply(input: CompleteInput): string {
  switch (input.purpose) {
    case "practice":
      return JSON.stringify({
        items: Array.from({ length: FAKE_PRACTICE_COUNT }, (_, i) => ({
          question: `Practice ${i + 1}: what is ${i + 10} plus ${i + 20}?`,
          answer: String(2 * i + 30),
          difficulty: 3,
        })),
      });
    case "flashcards":
      return JSON.stringify({ cards: [{ front: "Term", back: "Meaning" }, { front: "Idea", back: "Explanation" }] });
    case "summary":
      return JSON.stringify({ summary: "A short summary of the text.", keyPoints: ["First point", "Second point"] });
    case "quiz":
      return JSON.stringify({
        questions: [{ question: "Which option is right?", options: ["A", "B", "C", "D"], answerIndex: 1 }],
      });
    default:
      return "Think about what the question is asking. What is the first step you could take?";
  }
}

/** Deterministic provider for dev and tests: scripted replies first, then built-in defaults. */
export class FakeProvider implements AiProvider {
  readonly name = "fake";
  readonly enabled = true;
  readonly calls: CompleteInput[] = [];
  private scripts: Script[];
  private failuresLeft: number;

  constructor(options: { scripts?: Script[]; failures?: number } = {}) {
    this.scripts = [...(options.scripts ?? [])];
    this.failuresLeft = options.failures ?? 0;
  }

  /** Makes the next `count` calls fail; Infinity fails them all. */
  failNext(count: number): void {
    this.failuresLeft = count;
  }

  queue(...scripts: Script[]): void {
    this.scripts.push(...scripts);
  }

  async complete(input: CompleteInput): Promise<Completion> {
    this.calls.push(input);
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new ProviderError("fake provider failure", 503);
    }
    const script = this.scripts.shift();
    const text = script === undefined ? defaultReply(input) : typeof script === "string" ? script : script(input);
    return { text, usage: { inputTokens: input.messages.length * 10, outputTokens: Math.ceil(text.length / 4) } };
  }
}
