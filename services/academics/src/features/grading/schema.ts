import { array, isoDate, num, object, optional, string, externalId } from "../../lib/validate";

export const createSystemSchema = object({
  name: string({ max: 100 }),
  effectiveFrom: isoDate(),
  bands: array(
    object({ minPct: num({ min: 0, max: 100 }), maxPct: num({ min: 0, max: 100 }), grade: string({ max: 10 }), points: num({ min: 0, max: 100 }), remark: optional(string({ max: 100 })) }),
    { min: 1, max: 30 },
  ),
  passMarks: optional(array(object({ subjectId: optional(externalId()), passPct: num({ min: 0, max: 100 }) }), { max: 100 })),
});

export const passMarkSchema = object({ subjectId: optional(externalId()), passPct: num({ min: 0, max: 100 }) });
