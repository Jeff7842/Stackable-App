import { describe, expect, it } from "vitest";
import { gradeFor, isPass, normalise, validateBands, type BandInput } from "./bands";

const band = (minPct: number, maxPct: number, grade = "X"): BandInput => ({ minPct, maxPct, grade, points: 0 });

describe("validateBands", () => {
  it("accepts a clean whole-number cover", () => {
    expect(validateBands([band(0, 39), band(40, 79), band(80, 100)])).toEqual([]);
  });

  it("accepts bands given out of order", () => {
    expect(validateBands([band(80, 100), band(0, 39), band(40, 79)])).toEqual([]);
  });

  it("accepts a single 0 to 100 band", () => {
    expect(validateBands([band(0, 100)])).toEqual([]);
  });

  it("accepts decimal bands that are contiguous on the decimal grid", () => {
    expect(validateBands([band(0, 49.5), band(49.6, 100)])).toEqual([]);
    expect(validateBands([band(0, 49.99), band(50, 100)])).toEqual([]);
  });

  it("rejects an empty list", () => {
    expect(validateBands([])[0].code).toBe("EMPTY");
  });

  it("reports a gap with both rows", () => {
    const issues = validateBands([band(0, 39), band(41, 100)]);
    expect(issues).toEqual([{ code: "GAP", message: "Gap between bands", rows: [0, 1] }]);
  });

  it("reports a decimal gap", () => {
    expect(validateBands([band(0, 49.5), band(49.7, 100)]).map((i) => i.code)).toEqual(["GAP"]);
  });

  it("reports an overlap with both rows, using original indexes", () => {
    const issues = validateBands([band(40, 100), band(0, 40)]);
    expect(issues).toEqual([{ code: "OVERLAP", message: "Bands overlap", rows: [1, 0] }]);
  });

  it("reports a band nested inside another as an overlap", () => {
    expect(validateBands([band(0, 100), band(10, 20)]).map((i) => i.code)).toEqual(["OVERLAP"]);
  });

  it("requires the cover to start at 0", () => {
    expect(validateBands([band(1, 100)]).map((i) => i.code)).toContain("START");
  });

  it("requires the cover to end at 100", () => {
    expect(validateBands([band(0, 99)]).map((i) => i.code)).toContain("END");
  });

  it("rejects out of range, inverted and over-precise rows", () => {
    expect(validateBands([band(-1, 50), band(51, 100)])[0]).toMatchObject({ code: "RANGE", rows: [0] });
    expect(validateBands([band(0, 101)])[0]).toMatchObject({ code: "RANGE", rows: [0] });
    expect(validateBands([band(60, 40), band(0, 100)])[0]).toMatchObject({ code: "RANGE", rows: [0] });
    expect(validateBands([band(0, 33.333), band(33.334, 100)])[0].code).toBe("RANGE");
  });
});

describe("grading maths", () => {
  const bands = [band(0, 39, "E"), band(40, 79, "C"), band(80, 100, "A")];

  it("normalises raw over total to a percentage", () => {
    expect(normalise(45, 60)).toBe(75);
    expect(normalise(1, 3)).toBe(33.33);
    expect(normalise(0, 10)).toBe(0);
    expect(normalise(10, 10)).toBe(100);
  });

  it("rejects an impossible score", () => {
    expect(() => normalise(1, 0)).toThrow(RangeError);
    expect(() => normalise(11, 10)).toThrow(RangeError);
    expect(() => normalise(-1, 10)).toThrow(RangeError);
  });

  it("picks the band at every boundary", () => {
    expect(gradeFor(0, bands).grade).toBe("E");
    expect(gradeFor(39, bands).grade).toBe("E");
    expect(gradeFor(40, bands).grade).toBe("C");
    expect(gradeFor(79, bands).grade).toBe("C");
    expect(gradeFor(80, bands).grade).toBe("A");
    expect(gradeFor(100, bands).grade).toBe("A");
  });

  it("rounds a fractional percentage to the band grid before lookup", () => {
    expect(gradeFor(79.4, bands).grade).toBe("C");
    expect(gradeFor(79.5, bands).grade).toBe("A");
    expect(gradeFor(39.6, bands).grade).toBe("C");
  });

  it("uses the finer grid for decimal bands", () => {
    const fine = [band(0, 49.5, "L"), band(49.6, 100, "H")];
    expect(gradeFor(49.5, fine).grade).toBe("L");
    expect(gradeFor(49.6, fine).grade).toBe("H");
  });

  it("refuses a percentage outside 0 to 100", () => {
    expect(() => gradeFor(100.5, bands)).toThrow(RangeError);
    expect(() => gradeFor(-0.1, bands)).toThrow(RangeError);
  });

  it("passes at exactly the pass mark and fails just under it", () => {
    expect(isPass(50, 50)).toBe(true);
    expect(isPass(49.99, 50)).toBe(false);
  });
});
