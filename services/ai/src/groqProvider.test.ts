import { describe, expect, it, vi } from "vitest";
import { GROQ_URL, GroqProvider, DEFAULT_GROQ_MODEL } from "./groqProvider";
import { ProviderError } from "./provider";

const input = {
  system: "be a tutor",
  messages: [{ role: "user" as const, content: "help" }],
  maxTokens: 100,
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("GroqProvider", () => {
  it("is disabled without a key and never calls the network", async () => {
    const fetchFn = vi.fn();
    const p = new GroqProvider({ fetchFn: fetchFn as unknown as typeof fetch });
    expect(p.enabled).toBe(false);
    await expect(p.complete(input)).rejects.toBeInstanceOf(ProviderError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("maps the request to chat completions and the response to text and usage", async () => {
    const fetchFn = vi.fn(async () =>
      reply({ choices: [{ message: { content: "Try halving it." } }], usage: { prompt_tokens: 12, completion_tokens: 5 } }),
    );
    const p = new GroqProvider({ apiKey: "k", model: "m1", fetchFn: fetchFn as unknown as typeof fetch });
    const out = await p.complete(input);

    expect(out).toEqual({ text: "Try halving it.", usage: { inputTokens: 12, outputTokens: 5 } });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GROQ_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer k");
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: "m1",
      max_tokens: 100,
      messages: [
        { role: "system", content: "be a tutor" },
        { role: "user", content: "help" },
      ],
    });
  });

  it("uses the default model when none is set", async () => {
    const fetchFn = vi.fn(async () => reply({ choices: [{ message: { content: "x" } }] }));
    await new GroqProvider({ apiKey: "k", fetchFn: fetchFn as unknown as typeof fetch }).complete(input);
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(init.body as string).model).toBe(DEFAULT_GROQ_MODEL);
  });

  it("turns a non-2xx response into a ProviderError with the status", async () => {
    const fetchFn = vi.fn(async () => reply({ error: "rate" }, 429));
    const p = new GroqProvider({ apiKey: "k", fetchFn: fetchFn as unknown as typeof fetch });
    await expect(p.complete(input)).rejects.toMatchObject({ name: "ProviderError", status: 429 });
  });

  it("turns a network failure and an empty body into ProviderErrors", async () => {
    const down = new GroqProvider({
      apiKey: "k",
      fetchFn: (async () => Promise.reject(new Error("offline"))) as unknown as typeof fetch,
    });
    await expect(down.complete(input)).rejects.toBeInstanceOf(ProviderError);
    const empty = new GroqProvider({ apiKey: "k", fetchFn: (async () => reply({ choices: [] })) as unknown as typeof fetch });
    await expect(empty.complete(input)).rejects.toBeInstanceOf(ProviderError);
  });
});
