import { describe, expect, it } from "vitest";
import { parseDemoRole } from "./mode";

describe("parseDemoRole", () => {
  it("accepts known roles only", () => {
    expect(parseDemoRole("parent")).toBe("parent");
    expect(parseDemoRole("finance")).toBe("finance");
    expect(parseDemoRole("root")).toBeNull();
    expect(parseDemoRole(undefined)).toBeNull();
    expect(parseDemoRole("")).toBeNull();
  });
});
