export type LeakReason = "EXACT" | "SUBSTRING" | "NUMBER";
export type LeakCheck = { ok: true } | { ok: false; reason: LeakReason };

const MIN_SUBSTRING_KEY_LENGTH = 4; // shorter keys only match whole words, or "a" would flag everything
export const SAFE_FALLBACK_HINT =
  "Let us slow down. Re-read the question, tell me what you already know, and think about what the first step could be.";

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = { thousand: 1_000, million: 1_000_000 };

function isNumberWord(t: string): boolean {
  return t in UNITS || t === "hundred" || t in SCALES;
}

/** Lowercases and strips punctuation and thousands separators, keeping decimal points. */
function clean(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(?<=\d),(?=\d{3}(?!\d))/g, "")
    .replace(/(?<!\d)\.(?=\d)/g, "0.")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Turns runs like "one hundred and five" into "105" so words and digits compare equal.
function wordsToDigits(text: string): string {
  const tokens = text.split(" ");
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (!isNumberWord(tokens[i])) {
      out.push(tokens[i++]);
      continue;
    }
    let total = 0;
    let current = 0;
    let end = i;
    while (end < tokens.length) {
      const t = tokens[end];
      if (t in UNITS) current += UNITS[t];
      else if (t === "hundred") current = (current || 1) * 100;
      else if (t in SCALES) {
        total += (current || 1) * SCALES[t];
        current = 0;
      } else if (!(t === "and" && isNumberWord(tokens[end + 1] ?? ""))) break;
      end++;
    }
    out.push(String(total + current));
    i = end;
  }
  return out.join(" ");
}

// "0.50", "0.5" and "007" each reduce to one canonical form.
function canonicalNumbers(text: string): string {
  return text.replace(/\d+(?:\.\d+)?/g, (n) => String(Number(n)));
}

/** Full normalisation used for every comparison in this module. */
export function normalize(text: string): string {
  return canonicalNumbers(wordsToDigits(clean(text)));
}

const NUMBER_TOKEN = /(?<![\d.])\d+(?:\.\d+)?(?!\d|\.\d)/g;

function numbersIn(normalized: string): Set<string> {
  return new Set(normalized.match(NUMBER_TOKEN) ?? []);
}

// A key like "42" or "42 cm" is numeric: one number plus optional unit words.
function numericKey(normalizedKey: string): string | null {
  const m = /^(\d+(?:\.\d+)?)(?:\s*[a-z]+(?:\s+[a-z]+)?)?$/.exec(normalizedKey);
  return m ? m[1] : null;
}

function leakOne(normalizedReply: string, rawKey: string): LeakCheck {
  const key = normalize(rawKey);
  if (!key) return { ok: true };
  if (normalizedReply === key) return { ok: false, reason: "EXACT" };
  const number = numericKey(key);
  if (number !== null) {
    return numbersIn(normalizedReply).has(number) ? { ok: false, reason: "NUMBER" } : { ok: true };
  }
  const found =
    key.length >= MIN_SUBSTRING_KEY_LENGTH ? normalizedReply.includes(key) : ` ${normalizedReply} `.includes(` ${key} `);
  return found ? { ok: false, reason: "SUBSTRING" } : { ok: true };
}

/** Says whether a tutor reply gives the answer away; `ok` is true when it does not. */
export function checkNoAnswerLeak(reply: string, answerKey: string | readonly string[] | null | undefined): LeakCheck {
  if (answerKey === null || answerKey === undefined) return { ok: true };
  const normalizedReply = normalize(reply);
  for (const key of typeof answerKey === "string" ? [answerKey] : answerKey) {
    const result = leakOne(normalizedReply, key);
    if (!result.ok) return result;
  }
  return { ok: true };
}

/** Compares a student's practice answer with its key, ignoring case, punctuation and number format. */
export function answersMatch(given: string, key: string): boolean {
  const g = normalize(given);
  return g !== "" && g === normalize(key);
}

/** Prompt that asks the provider to redo a leaking reply as a guiding question. */
export function rewriteRequest(questionText: string): string {
  return [
    "Your previous reply gave away the answer. Rewrite it now.",
    "Reply with one short guiding question or hint. Do not state the final answer, the final number, or a full worked solution.",
    `Question: ${questionText}`,
  ].join("\n");
}

const KEY_FIELDS = new Set(["answer_key", "answerkey", "answer", "correctanswer", "correct_answer", "solution"]);

/** Returns a copy of the question without any answer fields, at every depth. */
export function withholdKey<T>(question: T): T {
  if (Array.isArray(question)) return question.map((q) => withholdKey(q)) as T;
  if (typeof question !== "object" || question === null) return question;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(question)) {
    if (!KEY_FIELDS.has(k.toLowerCase())) out[k] = withholdKey(v);
  }
  return out as T;
}
