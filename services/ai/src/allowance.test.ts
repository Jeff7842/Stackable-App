import { describe, expect, it } from "vitest";
import { allowanceStatus, dailyLimit, dayWindow } from "./allowance";
import type { AllowanceTier } from "./policy";

const tiers: AllowanceTier[] = [
  { minPoints: 100, dailyRequests: 25 },
  { minPoints: 50, dailyRequests: 15 },
  { minPoints: 200, dailyRequests: 40 },
];

describe("dailyLimit", () => {
  it("uses the base below the first tier", () => expect(dailyLimit(49, tiers, 10)).toBe(10));
  it("picks the highest reached tier regardless of list order", () => {
    expect(dailyLimit(50, tiers, 10)).toBe(15);
    expect(dailyLimit(150, tiers, 10)).toBe(25);
    expect(dailyLimit(5000, tiers, 10)).toBe(40);
  });
  it("uses the base with no tiers", () => expect(dailyLimit(999, [], 7)).toBe(7));
  it("only returns a request count, never a hint cap", () => {
    expect(typeof dailyLimit(200, tiers, 10)).toBe("number");
  });
});

describe("allowanceStatus", () => {
  it("is AVAILABLE while below the limit", () => {
    expect(allowanceStatus(10, 9)).toEqual({ status: "AVAILABLE", limit: 10, remaining: 1 });
  });
  it("is EXHAUSTED at and over the limit", () => {
    expect(allowanceStatus(10, 10).status).toBe("EXHAUSTED");
    expect(allowanceStatus(10, 12).remaining).toBe(0);
  });
});

describe("dayWindow", () => {
  it("starts at local midnight (UTC+3 means 21:00 UTC the day before)", () => {
    const { from, to } = dayWindow(new Date("2026-03-10T12:00:00Z"));
    expect(from.toISOString()).toBe("2026-03-09T21:00:00.000Z");
    expect(to.toISOString()).toBe("2026-03-10T21:00:00.000Z");
  });
  it("rolls to a new day after local midnight", () => {
    const before = dayWindow(new Date("2026-03-10T20:59:59Z"));
    const after = dayWindow(new Date("2026-03-10T21:00:00Z"));
    expect(after.from.getTime()).toBe(before.to.getTime());
  });
});
