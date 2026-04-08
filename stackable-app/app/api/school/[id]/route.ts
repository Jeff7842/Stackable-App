import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_: NextRequest, context: Context) {
  const { id } = await context.params;

  const { data, error } = await supabaseAdmin
    .from("school_usage_overview")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, context: Context) {
  const { id } = await context.params;
  const body = await req.json();

  const payload = {
    name: body.name,
    email: body.email,
    phone_1: body.phone_1,
    phone_2: body.phone_2 ?? null,
    phone_3: body.phone_3 ?? null,
    logo: body.logo,
    status: body.status,
    subscription_package: body.subscription_package,
    subscription_status: body.subscription_status,
    subscription_started_at: body.subscription_started_at,
    subscription_expires_at: body.subscription_expires_at,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("schools")
    .update(payload)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.head_name || body.owner_name) {
    await supabaseAdmin
      .from("school_profiles")
      .upsert({
        school_id: id,
        head_name: body.head_name ?? null,
        owner_name: body.owner_name ?? null,
        location: body.location ?? null,
        updated_at: new Date().toISOString(),
      });
  } else if (body.phone_2 || body.phone_3 || body.location) {
    await supabaseAdmin
      .from("school_profiles")
      .upsert({
        school_id: id,
        location: body.location ?? null,
        updated_at: new Date().toISOString(),
      });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, context: Context) {
  const { id } = await context.params;

  const { error } = await supabaseAdmin
    .from("schools")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
