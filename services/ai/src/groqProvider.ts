import { ProviderError, type AiProvider, type CompleteInput, type Completion } from "./provider";

export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_TIMEOUT_MS = 15_000; // a slow provider must not hold a student's request open
const TEMPERATURE = 0.3; // low, so hints stay on topic

export interface GroqOptions {
  apiKey?: string;
  model?: string;
  fetchFn?: typeof fetch;
}

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** OpenAI-compatible chat completions call; disabled until GROQ_API_KEY is set. */
export class GroqProvider implements AiProvider {
  readonly name = "groq";
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: GroqOptions = {}) {
    this.apiKey = options.apiKey || undefined;
    this.model = options.model || DEFAULT_GROQ_MODEL;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  get enabled(): boolean {
    return this.apiKey !== undefined;
  }

  async complete(input: CompleteInput): Promise<Completion> {
    if (!this.apiKey) throw new ProviderError("groq provider is disabled: GROQ_API_KEY not set");
    let res: Response;
    try {
      res = await this.fetchFn(GROQ_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          max_tokens: input.maxTokens,
          temperature: TEMPERATURE,
          messages: [{ role: "system", content: input.system }, ...input.messages],
        }),
        signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
      });
    } catch (err) {
      throw new ProviderError(`groq request failed: ${String(err)}`);
    }
    if (!res.ok) throw new ProviderError(`groq returned ${res.status}`, res.status);
    const data = (await res.json()) as GroqResponse;
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || text === "") throw new ProviderError("groq returned no content");
    return {
      text,
      usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
    };
  }
}
