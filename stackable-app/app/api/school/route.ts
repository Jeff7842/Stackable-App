import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAuth } from "@/lib/api/guard";
import { buildAuditContext } from "@/lib/api/audit-context";
import { toErrorResponse } from "@/lib/api/errors";
import { parseJson } from "@/lib/api/validate";
import {
  createSchoolRecord,
  discardNewSchool,
  listSchoolOverviews,
} from "@/lib/repositories/school-admin.repo";
import {
  buildSchoolSecurityCodeRows,
  createSchoolEmailConfirmationToken,
} from "@/lib/school-security";
import { createSchoolSchema } from "@/lib/validation/school-admin";
import SchoolConfirmationEmail from "@/components/email/school-confirmation-email";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, { roles: ["admin", "super-admin"], rateLimit: "read" });
    // A school admin only ever sees their own school; a super-admin sees every school.
    const onlyId = auth.role === "super-admin" ? undefined : auth.schoolId;
    const data = await listSchoolOverviews({ onlyId });
    return NextResponse.json({ data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req, { roles: ["admin", "super-admin"], rateLimit: "mutation" });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const body = await parseJson(req, createSchoolSchema);
    const audit = buildAuditContext(req, auth);

    const schoolId = crypto.randomUUID();
    const now = new Date();
    const confirmationExpiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3);
    const token = createSchoolEmailConfirmationToken({
      schoolId,
      email: body.email,
      expiresAt: confirmationExpiresAt.toISOString(),
    });

    const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const confirmationUrl = `${appBaseUrl}/api/school/${schoolId}/confirm-email?token=${encodeURIComponent(token)}`;

    const created = await createSchoolRecord(
      {
        id: schoolId,
        name: body.name,
        email: body.email,
        phone_1: body.phone_1,
        phone_2: body.phone_2 ?? null,
        phone_3: body.phone_3 ?? null,
        head_name: body.head_name ?? null,
        owner_name: body.owner_name ?? null,
        location: body.location ?? null,
        logo: body.logo ?? null,
        subscription_package: body.subscription_package ?? "Seedling",
        subscription_status: body.subscription_status ?? "trial",
        subscription_started_at: body.subscription_started_at ?? now,
        subscription_expires_at: body.subscription_expires_at ?? null,
        expected_users: body.expected_users ?? 0,
        expected_students: body.expected_students ?? 0,
        expected_parents: body.expected_parents ?? 0,
        expected_teachers: body.expected_teachers ?? 0,
        expected_admins: body.expected_admins ?? 0,
        expected_staff: body.expected_staff ?? 0,
      },
      buildSchoolSecurityCodeRows(schoolId),
      audit,
    );

    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!fromEmail) {
      await discardNewSchool(schoolId, audit);
      return NextResponse.json({ error: "Missing RESEND_FROM_EMAIL." }, { status: 500 });
    }

    const { error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: body.email,
      subject: `Confirm ${body.name} on Stackable`,
      react: SchoolConfirmationEmail({
        schoolName: body.name,
        schoolCode: created.code,
        confirmationUrl,
      }),
    });

    if (sendError) {
      await discardNewSchool(schoolId, audit);
      return NextResponse.json({ error: "School created but could not send confirmation email." }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, data: created, message: "School created and confirmation email sent." },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
