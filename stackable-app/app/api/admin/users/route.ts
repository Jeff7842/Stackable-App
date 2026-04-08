import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ALLOWED_ROLES = ["manager", "admin", "super-admin", "teacher", "student"] as const;
const ALLOWED_STATUSES = ["active", "suspended", "pending"] as const;

const PAGE_KEYS = [
  "dashboard",
  "users",
  "students",
  "teachers",
  "parents",
  "classes",
  "subjects",
  "payments",
  "library",
  "exams",
  "assignments",
  "reports",
  "settings",
  "notifications",
] as const;

function isAllowedRole(value: string) {
  return ALLOWED_ROLES.includes(value as (typeof ALLOWED_ROLES)[number]);
}

function isAllowedStatus(value: string) {
  return ALLOWED_STATUSES.includes(value as (typeof ALLOWED_STATUSES)[number]);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const role = searchParams.get("role") ?? "all";
    const status = searchParams.get("status") ?? "all";
    const schoolId = searchParams.get("schoolId") ?? "all";

    let query = supabase
      .from("users")
      .select(`
        id,
        created_at,
        updated_at,
        school_id,
        school_code,
        school_adm,
        email,
        phone,
        phone_2,
        role,
        status,
        first_name,
        last_name,
        must_change_password,
        schools:school_id (
          id,
          name,
          code
        )
      `)
      .order("created_at", { ascending: false });

    if (role !== "all") query = query.eq("role", role);
    if (status !== "all") query = query.eq("status", status);
    if (schoolId !== "all") query = query.eq("school_id", schoolId);

    const { data: users, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filtered = (users ?? []).filter((user) => {
      if (!search) return true;
      const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.toLowerCase();
      const email = (user.email ?? "").toLowerCase();
      const phone = String(user.phone ?? "").toLowerCase();
      const phone2 = String(user.phone_2 ?? "").toLowerCase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schoolName = ((user as any).schools?.name ?? "").toLowerCase();
      const roleValue = (user.role ?? "").toLowerCase();

      return (
        fullName.includes(search.toLowerCase()) ||
        email.includes(search.toLowerCase()) ||
        phone.includes(search.toLowerCase()) ||
        phone2.includes(search.toLowerCase()) ||
        schoolName.includes(search.toLowerCase()) ||
        roleValue.includes(search.toLowerCase())
      );
    });

    const userIds = filtered.map((item) => item.id);

    let permissionsMap: Record<string, { page_key: string; can_access: boolean }[]> = {};

    if (userIds.length) {
      const { data: permissions } = await supabase
        .from("user_page_permissions")
        .select("user_id, page_key, can_access")
        .in("user_id", userIds);

      permissionsMap = (permissions ?? []).reduce((acc, item) => {
        if (!acc[item.user_id]) acc[item.user_id] = [];
        acc[item.user_id].push({
          page_key: item.page_key,
          can_access: item.can_access,
        });
        return acc;
      }, {} as Record<string, { page_key: string; can_access: boolean }[]>);
    }

    return NextResponse.json({
      users: filtered.map((user) => ({
        ...user,
        permissions: permissionsMap[user.id] ?? [],
      })),
      pageKeys: PAGE_KEYS,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      first_name,
      last_name,
      email,
      phone,
      phone_2,
      school_id,
      role,
      photo_url,
      permissions = [],
    } = body;

    if (!first_name || !last_name || !school_id || !role) {
      return NextResponse.json(
        { error: "first_name, last_name, school_id and role are required." },
        { status: 400 }
      );
    }

    if (!isAllowedRole(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    const { data: insertedUser, error: insertError } = await supabase
      .from("users")
      .insert({
        first_name,
        last_name,
        email: email || null,
        phone: phone || null,
        phone_2: phone_2 || null,
        school_id,
        role,
        status: "pending",
        must_change_password: true,
      })
      .select(`
        id,
        created_at,
        updated_at,
        school_id,
        school_code,
        school_adm,
        email,
        phone,
        phone_2,
        role,
        status,
        first_name,
        last_name,
        must_change_password,
        schools:school_id (
          id,
          name,
          code
        )
      `)
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    if (photo_url) {
      await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: insertedUser.id,
            photo_url,
          },
          { onConflict: "user_id" }
        );
    }

    const sanitizedPermissions = Array.isArray(permissions)
      ? permissions
          .filter((item) => PAGE_KEYS.includes(item.page_key))
          .map((item) => ({
            user_id: insertedUser.id,
            page_key: item.page_key,
            can_access: !!item.can_access,
          }))
      : [];

    if (sanitizedPermissions.length) {
      const { error: permissionsError } = await supabase
        .from("user_page_permissions")
        .upsert(sanitizedPermissions, {
          onConflict: "user_id,page_key",
        });

      if (permissionsError) {
        return NextResponse.json({ error: permissionsError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ user: insertedUser }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      id,
      email,
      status,
      role,
      must_change_password,
      clear_history,
      permissions,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "User id is required." }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {};

    if (typeof email !== "undefined") updatePayload.email = email || null;
    if (typeof status !== "undefined") {
      if (!isAllowedStatus(status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      updatePayload.status = status;
    }

    if (typeof role !== "undefined") {
      if (!isAllowedRole(role)) {
        return NextResponse.json({ error: "Invalid role." }, { status: 400 });
      }
      updatePayload.role = role;
    }

    if (typeof must_change_password !== "undefined") {
      updatePayload.must_change_password = !!must_change_password;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (Array.isArray(permissions)) {
      const { error: deleteOldPermissionsError } = await supabase
        .from("user_page_permissions")
        .delete()
        .eq("user_id", id);

      if (deleteOldPermissionsError) {
        return NextResponse.json(
          { error: deleteOldPermissionsError.message },
          { status: 500 }
        );
      }

      const nextPermissions = permissions
        .filter((item) => PAGE_KEYS.includes(item.page_key))
        .map((item) => ({
          user_id: id,
          page_key: item.page_key,
          can_access: !!item.can_access,
        }));

      if (nextPermissions.length) {
        const { error: insertPermissionsError } = await supabase
          .from("user_page_permissions")
          .insert(nextPermissions);

        if (insertPermissionsError) {
          return NextResponse.json(
            { error: insertPermissionsError.message },
            { status: 500 }
          );
        }
      }
    }

    if (clear_history) {
      // Replace these with your real audit/history tables.
      await Promise.allSettled([
        supabase.from("activity_logs").delete().eq("user_id", id),
        supabase.from("login_history").delete().eq("user_id", id),
        supabase.from("notifications").delete().eq("user_id", id),
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "User id is required." }, { status: 400 });
    }

    const { error } = await supabase.from("users").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown server error" },
      { status: 500 }
    );
  }
}