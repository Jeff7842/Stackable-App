import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { buildAuditContext } from "@/lib/api/audit-context";
import { toErrorResponse } from "@/lib/api/errors";
import { parseJson } from "@/lib/api/validate";
import {
  createUserRecord,
  deleteUserRecord,
  findUserTarget,
  listUsersWithPermissions,
  updateUserRecord,
} from "@/lib/repositories/user.repo";
import { PAGE_KEYS } from "@/lib/validation/shared";
import {
  checkUserCreate,
  checkUserDelete,
  checkUserUpdate,
  createUserSchema,
  deleteUserQuerySchema,
  updateUserSchema,
  USER_ADMIN_ROLES,
} from "@/lib/validation/user-admin";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, { roles: USER_ADMIN_ROLES, rateLimit: "read" });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const role = searchParams.get("role") ?? "all";
    const status = searchParams.get("status") ?? "all";
    const schoolId = searchParams.get("schoolId") ?? "all";

    const users = await listUsersWithPermissions({ schoolId, role, status, search });
    return NextResponse.json({ users, pageKeys: PAGE_KEYS });
  } catch (error) {
    console.error("admin users list route error", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(request, { roles: USER_ADMIN_ROLES, rateLimit: "mutation", denyImpersonation: true });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const body = await parseJson(request, createUserSchema);

    const denial = checkUserCreate({ id: auth.userId, role: auth.role, schoolId: auth.schoolId }, body);
    if (denial) return NextResponse.json({ error: denial.message, code: denial.code }, { status: denial.status });

    const audit = buildAuditContext(request, auth);
    const user = await createUserRecord(body, audit);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(request, { roles: USER_ADMIN_ROLES, rateLimit: "mutation", denyImpersonation: true });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const body = await parseJson(request, updateUserSchema);

    const target = await findUserTarget(body.id);
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const denial = checkUserUpdate({ id: auth.userId, role: auth.role, schoolId: auth.schoolId }, target, body);
    if (denial) return NextResponse.json({ error: denial.message, code: denial.code }, { status: denial.status });

    const audit = buildAuditContext(request, auth);
    await updateUserRecord(body, audit);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(request, { roles: ["super-admin"], rateLimit: "mutation", denyImpersonation: true });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = deleteUserQuerySchema.safeParse({ id: searchParams.get("id") ?? "" });
    if (!parsed.success) {
      return NextResponse.json({ error: "User id is required." }, { status: 400 });
    }

    const target = await findUserTarget(parsed.data.id);
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

    const denial = checkUserDelete({ id: auth.userId, role: auth.role, schoolId: auth.schoolId }, target);
    if (denial) return NextResponse.json({ error: denial.message, code: denial.code }, { status: denial.status });

    const audit = buildAuditContext(request, auth);
    await deleteUserRecord(parsed.data.id, audit);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
