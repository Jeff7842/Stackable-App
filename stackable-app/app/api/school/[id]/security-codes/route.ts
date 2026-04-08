import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildSchoolSecurityCodeEntries,
  buildSchoolSecurityCodeRows,
  buildSchoolSecurityCodesPdf,
  hashSchoolSecurityCode,
  SCHOOL_SECURITY_CODE_LABELS,
  type SchoolSecurityCodeLabel,
} from "@/lib/school-security";

type Context = {
  params: Promise<{ id: string }>;
};

type SchoolSecurityCodeRow = {
  code_hash: string;
  code_label: SchoolSecurityCodeLabel;
  is_active: boolean;
  used_count: number;
};

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function ensureSchoolSecurityRows(schoolId: string) {
  const { data: existingRows, error } = await supabaseAdmin
    .from("school_security_codes")
    .select("code_hash, code_label, is_active, used_count")
    .eq("school_id", schoolId);

  if (error) {
    throw new Error(error.message);
  }

  const typedRows = (existingRows ?? []) as SchoolSecurityCodeRow[];
  const existingLabels = new Set(typedRows.map((row) => row.code_label));
  const missingLabels = SCHOOL_SECURITY_CODE_LABELS.filter(
    (label) => !existingLabels.has(label),
  );

  if (missingLabels.length > 0) {
    const rows = buildSchoolSecurityCodeRows(schoolId).filter((row) =>
      missingLabels.includes(row.code_label),
    );

    const { error: insertError } = await supabaseAdmin
      .from("school_security_codes")
      .insert(rows);

    if (insertError) {
      throw new Error(insertError.message);
    }

    return [
      ...typedRows,
      ...rows.map((row) => ({
        code_hash: row.code_hash,
        code_label: row.code_label,
        is_active: row.is_active,
        used_count: row.used_count,
      })),
    ];
  }

  return typedRows;
}

export async function GET(_: NextRequest, context: Context) {
  try {
    const { id } = await context.params;

    const { data: school, error } = await supabaseAdmin
      .from("schools")
      .select("id, name, code, email")
      .eq("id", id)
      .maybeSingle();

    if (error || !school) {
      return NextResponse.json({ error: "School not found." }, { status: 404 });
    }

    const rows = await ensureSchoolSecurityRows(school.id);
    const activeRows = rows.filter((row) => row.is_active);

    if (activeRows.length === 0) {
      return NextResponse.json(
        { error: "No active security codes found for this school." },
        { status: 404 },
      );
    }

    const generatedEntries = buildSchoolSecurityCodeEntries(school.id);
    const generatedByLabel = new Map(
      generatedEntries.map((entry) => [entry.label, entry.code]),
    );

    const codes = activeRows.map((row) => {
      const code = generatedByLabel.get(row.code_label);
      if (!code) {
        throw new Error(`Missing generator for label ${row.code_label}.`);
      }

      const matchesHash = hashSchoolSecurityCode(code) === row.code_hash;
      if (!matchesHash) {
        throw new Error(
          `Stored security code hash did not match the generated code for ${row.code_label}.`,
        );
      }

      return {
        label: row.code_label,
        code,
      };
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
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 },
    );
  }
}
