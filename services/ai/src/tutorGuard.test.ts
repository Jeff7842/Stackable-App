import { describe, expect, it } from "vitest";
import { answersMatch, checkNoAnswerLeak, normalize, rewriteRequest, withholdKey } from "./tutorGuard";

const leaks = (reply: string, key: string) => !checkNoAnswerLeak(reply, key).ok;

describe("checkNoAnswerLeak", () => {
  it("detects the exact key, ignoring case, space and punctuation", () => {
    expect(checkNoAnswerLeak("  PHOTOSYNTHESIS!! ", "photosynthesis")).toEqual({ ok: false, reason: "EXACT" });
  });

  it("detects the key as a substring of a sentence", () => {
    expect(checkNoAnswerLeak("It is called Photosynthesis, by the way.", "photosynthesis")).toEqual({
      ok: false,
      reason: "SUBSTRING",
    });
  });

  it("detects a multi-word key with different spacing", () => {
    expect(leaks("the   Mitochondria\nis the powerhouse", "The mitochondria is the powerhouse")).toBe(true);
  });

  it("detects a number written in digits inside a sentence", () => {
    expect(checkNoAnswerLeak("So you get 42 in total.", "42")).toEqual({ ok: false, reason: "NUMBER" });
  });

  it.each([
    ["The answer is forty-two.", "42"],
    ["forty two", "42"],
    ["one hundred and five", "105"],
    ["Two thousand and six", "2006"],
    ["three million", "3000000"],
  ])("detects numbers in words: %s", (reply, key) => {
    expect(leaks(reply, key)).toBe(true);
  });

  it.each([
    ["It is 1,000 shillings", "1000"],
    ["It is 1000.00 shillings", "1000"],
    ["about 0.50 of it", "0.5"],
    ["about .5 of it", "0.5"],
  ])("normalises number formats: %s", (reply, key) => {
    expect(leaks(reply, key)).toBe(true);
  });

  it.each([
    ["that is 42cm long", "42"],
    ["that is 42 centimetres", "42 cm"],
    ["forty-two centimetres", "42 cm"],
    ["Ksh 500", "500"],
    ["it is 25%", "25"],
  ])("detects unit variants: %s vs %s", (reply, key) => {
    expect(leaks(reply, key)).toBe(true);
  });

  it("does not flag numbers that only share digits with the key", () => {
    expect(leaks("Try 420 or 4.2 or 142", "42")).toBe(false);
  });

  it("does not flag a normal hint", () => {
    const hint = "Think about what each side of the equation represents. What happens if you add the same amount to both?";
    expect(leaks(hint, "42")).toBe(false);
    expect(leaks(hint, "photosynthesis")).toBe(false);
  });

  it("matches short text keys on whole words only", () => {
    expect(leaks("It is a cat", "cat")).toBe(true);
    expect(leaks("It is a category", "cat")).toBe(false);
  });

  it("checks every key of a list and skips a blank or missing key", () => {
    expect(checkNoAnswerLeak("it is blue", ["red", "blue"]).ok).toBe(false);
    expect(checkNoAnswerLeak("anything", "   ").ok).toBe(true);
    expect(checkNoAnswerLeak("anything", null).ok).toBe(true);
    expect(checkNoAnswerLeak("anything", undefined).ok).toBe(true);
  });
});

describe("answersMatch", () => {
  it("compares across case, punctuation and number format", () => {
    expect(answersMatch(" Forty-Two. ", "42")).toBe(true);
    expect(answersMatch("1,000", "1000")).toBe(true);
    expect(answersMatch("41", "42")).toBe(false);
    expect(answersMatch("", "42")).toBe(false);
  });
});

describe("normalize", () => {
  it("is idempotent", () => {
    const once = normalize("One Hundred and Five, 3,500.50!");
    expect(normalize(once)).toBe(once);
  });
});

describe("rewriteRequest", () => {
  it("asks for a guiding question and carries the question text", () => {
    const text = rewriteRequest("What is 6 times 7?");
    expect(text).toContain("What is 6 times 7?");
    expect(text.toLowerCase()).toContain("guiding question");
  });
});

describe("withholdKey", () => {
  it("strips answer fields at every depth and keeps the rest", () => {
    const question = {
      id: "q1",
      text: "2+2?",
      answer_key: "4",
      options: [{ label: "A", correctAnswer: true }, { label: "B" }],
      meta: { solution: "add", difficulty: 2 },
    };
    expect(withholdKey(question)).toEqual({
      id: "q1",
      text: "2+2?",
      options: [{ label: "A" }, { label: "B" }],
      meta: { difficulty: 2 },
    });
    expect(JSON.stringify(withholdKey(question))).not.toContain('"4"');
  });

  it("does not change the original and passes primitives through", () => {
    const q = { answerKey: "x", t: 1 };
    withholdKey(q);
    expect(q.answerKey).toBe("x");
    expect(withholdKey("plain")).toBe("plain");
    expect(withholdKey(null)).toBeNull();
  });
});
