import { errors } from "@stackable/service-kit";

interface Issue {
  path: string;
  message: string;
}

/** Collects every field problem, then throws one 400 envelope listing them all. */
export class Validator {
  private issues: Issue[] = [];

  private constructor(private readonly body: Record<string, unknown>) {}

  static from(raw: unknown): Validator {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw errors.validation("Body must be a JSON object");
    }
    return new Validator(raw as Record<string, unknown>);
  }

  has(key: string): boolean {
    return this.body[key] !== undefined;
  }

  string(key: string, max: number, min = 1): string {
    const v = this.body[key];
    if (typeof v !== "string" || v.trim().length < min || v.length > max) {
      this.issues.push({ path: key, message: `must be a string of ${min} to ${max} characters` });
      return "";
    }
    return v;
  }

  optionalString(key: string, max: number): string | undefined {
    return this.has(key) ? this.string(key, max) : undefined;
  }

  int(key: string, min: number, max: number, fallback: number): number {
    const v = this.body[key];
    if (v === undefined) return fallback;
    if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
      this.issues.push({ path: key, message: `must be an integer from ${min} to ${max}` });
      return fallback;
    }
    return v;
  }

  bool(key: string): boolean {
    const v = this.body[key];
    if (typeof v !== "boolean") {
      this.issues.push({ path: key, message: "must be true or false" });
      return false;
    }
    return v;
  }

  oneOf<T extends string>(key: string, values: readonly T[], fallback: T): T {
    const v = this.body[key];
    if (v === undefined) return fallback;
    if (typeof v !== "string" || !values.includes(v as T)) {
      this.issues.push({ path: key, message: `must be one of ${values.join(", ")}` });
      return fallback;
    }
    return v as T;
  }

  /** Throws the 400 envelope when any field failed. */
  done(): void {
    if (this.issues.length > 0) throw errors.validation("Request validation failed", { fields: this.issues });
  }
}
