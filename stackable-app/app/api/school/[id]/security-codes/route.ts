import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { notFound, toErrorResponse } from "@/lib/api/errors";
import {
  findSchoolForCodes,
  insertMissingSecurityCodes,
  listSecurityCodeRows,
} from "@/lib/repositories/school-admin.repo";
import {
  buildSchoolSecurityCodeEntries,
  buildSchoolSecurityCodeRows,
  buildSchoolSecurityCodesPdf,
  hashSchoolSecurityCode,
  SCHOOL_SECURITY_CODE_LABELS,
  type SchoolSecurityCodeLabel,
} from "@/lib/school-security";

type Context = { params: Promise<{ id: string }> };

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function ensureSchoolSecurityRows(schoolId: string) {
  const existingRows = await listSecurityCodeRows(schoolId);
  const existingLabels = new Set(existingRows.map((row) => row.code_label));
  const missingLabels = SCHOOL_SECURITY_CODE_LABELS.filter((label) => !existingLabels.has(label));

  if (missingLabels.length === 0) return existingRows;

  const rows = buildSchoolSecurityCodeRows(schoolId).filter((row) =>
    missingLabels.includes(row.code_label as SchoolSecurityCodeLabel),
  );
  await insertMissingSecurityCodes(rows);
  return [...existingRows, ...rows];
}

export async function GET(request: NextRequest, context: Context) {
  let ctx;
  try {
    ctx = await requireAuth(request, { roles: ["super-admin"], rateLimit: "read", denyImpersonation: true });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const { id } = await context.params;

    // Cross-tenant guard: super-admins can access any school's codes. Non-super-admins are
    // already blocked by the role check above. Return 404 (not 403) so a stray id never
    // confirms a school's existence to someone who should not be here.
    if (ctx.role !== "super-admin" && id !== ctx.schoolId) {
      return toErrorResponse(notFound());
    }

    const school = await findSchoolForCodes(id);
    if (!school) {
      return NextResponse.json({ error: "School not found." }, { status: 404 });
    }

    const rows = await ensureSchoolSecurityRows(school.id);
    const activeRows = rows.filter((row) => row.is_active);

    if (activeRows.length === 0) {
      return NextResponse.json({ error: "No active security codes found for this school." }, { status: 404 });
    }

    const generatedEntries = buildSchoolSecurityCodeEntries(school.id);
    const generatedByLabel = new Map(generatedEntries.map((entry) => [entry.label, entry.code]));

    const codes = activeRows.map((row) => {
      const label = row.code_label as SchoolSecurityCodeLabel;
      const code = generatedByLabel.get(label);
      if (!code) throw new Error(`Missing generator for label ${label}.`);
      if (hashSchoolSecurityCode(code) !== row.code_hash) {
        throw new Error(`Stored security code hash did not match the generated code for ${label}.`);
      }
      return { label, code };
    });

    const pdf = buildSchoolSecurityCodesPdf({
      schoolName: school.name,
      schoolCode: school.code,
      schoolEmail: school.email,
      codes,
      generatedAt: new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()),
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFileName(school.name)}-security-codes.pdf"`,
      },
    });
  } catch (error) {
    console.error("school security codes route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}
