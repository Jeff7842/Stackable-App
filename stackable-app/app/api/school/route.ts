import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildSchoolSecurityCodeRows,
  createSchoolEmailConfirmationToken,
  generateSchoolCode,
} from "@/lib/school-security";
import SchoolConfirmationEmail from "@/components/email/school-confirmation-email";

const resend = new Resend(process.env.RESEND_API_KEY);

type CreateSchoolBody = {
  name?: string;
  email?: string;
  phone_1?: string;
  phone_2?: string;
  phone_3?: string;
  head_name?: string;
  owner_name?: string;
  location?: string;
  logo?: string;
  subscription_package?: string;
  subscription_status?: string;
  subscription_started_at?: string | null;
  subscription_expires_at?: string | null;
  expected_users?: number;
  expected_students?: number;
  expected_parents?: number;
  expected_teachers?: number;
  expected_admins?: number;
  expected_staff?: number;
};

function asText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
}

async function getNextSchoolNumber() {
  const { data, error } = await supabaseAdmin
    .from("schools")
    .select("school_id")
    .order("school_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.school_id ?? 0) + 1;
}

async function generateUniqueSchoolCode(name: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateSchoolCode(name);

    const { data, error } = await supabaseAdmin
      .from("schools")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return code;
    }
  }

  throw new Error("Failed to generate a unique school code.");
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("school_usage_overview")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateSchoolBody;

    const name = asText(body.name);
    const email = asText(body.email);
    const phone1 = asText(body.phone_1);

    if (!name || !email || !phone1) {
      return NextResponse.json(
        { error: "School name, school email, and primary phone are required." },
        { status: 400 },
      );
    }

    const subscriptionPackage = asText(body.subscription_package) ?? "Seedling";
    const subscriptionStatus = asText(body.subscription_status) ?? "trial";
    const expectedStudents = asNumber(body.expected_students, 0);
    const expectedParents = asNumber(body.expected_parents, 0);
    const expectedTeachers = asNumber(body.expected_teachers, 0);
    const expectedAdmins = asNumber(body.expected_admins, 0);
    const expectedStaff = asNumber(body.expected_staff, 0);
    const expectedUsers =
      asNumber(body.expected_users, 0) ||
      expectedStudents +
        expectedParents +
        expectedTeachers +
        expectedAdmins +
        expectedStaff;

    const schoolId = crypto.randomUUID();
    const schoolNumber = await getNextSchoolNumber();
    const schoolCode = await generateUniqueSchoolCode(name);
    const confirmationExpiresAt = new Date(
      Date.now() + 1000 * 60 * 60 * 24 * 3,
    ).toISOString();
    const token = createSchoolEmailConfirmationToken({
      schoolId,
      email,
      expiresAt: confirmationExpiresAt,
    });

    const appBaseUrl =
      process.env.APP_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      req.nextUrl.origin;

    const confirmationUrl = `${appBaseUrl}/api/school/${schoolId}/confirm-email?token=${encodeURIComponent(token)}`;
    const now = new Date().toISOString();

    const { error: schoolError } = await supabaseAdmin.from("schools").insert({
      id: schoolId,
      school_id: schoolNumber,
      name,
      code: schoolCode,
      logo: asText(body.logo),
      email,
      phone_1: phone1,
      phone_2: asText(body.phone_2),
      phone_3: asText(body.phone_3),
      status: "pending",
      subscription_package: subscriptionPackage,
      subscription_status: subscriptionStatus,
      subscription_started_at: asText(body.subscription_started_at) ?? now,
      subscription_expires_at: asText(body.subscription_expires_at),
      expected_users: expectedUsers,
      expected_students: expectedStudents,
      expected_parents: expectedParents,
      expected_teachers: expectedTeachers,
      expected_admins: expectedAdmins,
      expected_staff: expectedStaff,
      updated_at: now,
    });

    if (schoolError) {
      return NextResponse.json({ error: schoolError.message }, { status: 500 });
    }

    const { error: profileError } = await supabaseAdmin
      .from("school_profiles")
      .upsert({
        school_id: schoolId,
        head_name: asText(body.head_name),
        owner_name: asText(body.owner_name),
        location: asText(body.location),
        updated_at: now,
      });

    if (profileError) {
      await supabaseAdmin.from("schools").delete().eq("id", schoolId);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const { error: securityCodeError } = await supabaseAdmin
      .from("school_security_codes")
      .insert(buildSchoolSecurityCodeRows(schoolId));

    if (securityCodeError) {
      await supabaseAdmin.from("school_profiles").delete().eq("school_id", schoolId);
      await supabaseAdmin.from("schools").delete().eq("id", schoolId);
      return NextResponse.json(
        { error: securityCodeError.message },
        { status: 500 },
      );
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!fromEmail) {
      await supabaseAdmin.from("school_profiles").delete().eq("school_id", schoolId);
      await supabaseAdmin.from("schools").delete().eq("id", schoolId);
      return NextResponse.json(
        { error: "Missing RESEND_FROM_EMAIL." },
        { status: 500 },
      );
    }

    const { error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Confirm ${name} on Stackable`,
      react: SchoolConfirmationEmail({
        schoolName: name,
        schoolCode: schoolCode,
        confirmationUrl,
      }),
    });

    if (sendError) {
      await supabaseAdmin.from("school_profiles").delete().eq("school_id", schoolId);
      await supabaseAdmin.from("schools").delete().eq("id", schoolId);
      return NextResponse.json(
        { error: "School created could not send confirmation email." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          id: schoolId,
          school_id: schoolNumber,
          name,
          code: schoolCode,
          email,
          status: "pending",
        },
        message: "School created and confirmation email sent.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("create school route error", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
