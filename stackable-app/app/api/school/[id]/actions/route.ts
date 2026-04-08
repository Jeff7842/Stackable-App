import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateSchoolCode } from "@/lib/school-security";

type Context = {
  params: Promise<{ id: string }>;
};

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

export async function POST(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as { action?: string };
    const action = String(body.action ?? "").trim();

    if (!action) {
      return NextResponse.json({ error: "Missing action." }, { status: 400 });
    }

    const { data: school, error } = await supabaseAdmin
      .from("school_usage_overview")
      .select(`
        id,
        name,
        status,
        code_change_count,
        expected_users,
        expected_students,
        expected_parents,
        expected_teachers,
        expected_admins,
        expected_staff
      `)
      .eq("id", id)
      .single();

    if (error || !school) {
      return NextResponse.json({ error: "School not found." }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === "activate") {
      const { error: updateError } = await supabaseAdmin
        .from("schools")
        .update({
          status: "active",
          pending_status_change_at: null,
          updated_at: now,
        })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: "School activated successfully.",
      });
    }

    if (action === "suspend") {
      const { error: updateError } = await supabaseAdmin
        .from("schools")
        .update({
          status: "suspended",
          pending_status_change_at: new Date(
            Date.now() + 30 * 60 * 1000,
          ).toISOString(),
          updated_at: now,
        })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: "School suspension has been queued.",
      });
    }

    if (action === "increase_capacity_50") {
      const { error: updateError } = await supabaseAdmin
        .from("schools")
        .update({
          expected_users: Number(school.expected_users ?? 0) + 50,
          expected_students: Number(school.expected_students ?? 0) + 10,
          expected_parents: Number(school.expected_parents ?? 0) + 10,
          expected_teachers: Number(school.expected_teachers ?? 0) + 10,
          expected_admins: Number(school.expected_admins ?? 0) + 10,
          expected_staff: Number(school.expected_staff ?? 0) + 10,
          updated_at: now,
        })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: "School capacity increased by 50 users.",
      });
    }

    if (action === "regenerate_code") {
      if (Number(school.code_change_count ?? 0) >= 3) {
        return NextResponse.json(
          { error: "This school has already used all 3 code regeneration attempts." },
          { status: 400 },
        );
      }

      const nextCode = await generateUniqueSchoolCode(String(school.name ?? "school"));

      const { error: updateError } = await supabaseAdmin
        .from("schools")
        .update({
          code: nextCode,
          code_change_count: Number(school.code_change_count ?? 0) + 1,
          pending_code_change_at: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          updated_at: now,
        })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: "School code regeneration queued successfully.",
      });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    console.error("school action route error", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
