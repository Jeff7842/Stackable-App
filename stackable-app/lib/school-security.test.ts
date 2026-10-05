import { afterEach, describe, expect, it, vi } from "vitest";
import { generateSchoolSecurityCode } from "./school-security";

describe("school security codes", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("throws instead of using a hardcoded secret", () => {
    vi.stubEnv("SCHOOL_SECURITY_CODES_SECRET", "");
    expect(() => generateSchoolSecurityCode("school-1", "BILLING_AUTH")).toThrow(/SCHOOL_SECURITY_CODES_SECRET/);
  });

  it("is stable per school and label, and differs by secret", () => {
    vi.stubEnv("SCHOOL_SECURITY_CODES_SECRET", "secret-a");
    const a = generateSchoolSecurityCode("school-1", "BILLING_AUTH");
    expect(generateSchoolSecurityCode("school-1", "BILLING_AUTH")).toBe(a);
    expect(generateSchoolSecurityCode("school-1", "STAFF_RESET_AUTH")).not.toBe(a);
    vi.stubEnv("SCHOOL_SECURITY_CODES_SECRET", "secret-b");
    expect(generateSchoolSecurityCode("school-1", "BILLING_AUTH")).not.toBe(a);
  });
});
