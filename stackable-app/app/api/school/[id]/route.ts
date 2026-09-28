import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { buildAuditContext } from "@/lib/api/audit-context";
import { forbidden, notFound, toErrorResponse } from "@/lib/api/errors";
import { parseJson } from "@/lib/api/validate";
import {
  deleteSchoolRecord,
  findSchoolDetail,
  findSchoolSensitiveFields,
  updateSchoolRecord,
} from "@/lib/repositories/school-admin.repo";
import {
  canAccessSchool,
  findSensitiveSchoolChanges,
  isPackageAllowed,
  SENSITIVE_DENIED_MESSAGE,
  updateSchoolSchema,
} from "@/lib/validation/school-admin";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = await requireAuth(request, { roles: ["admin", "super-admin"], rateLimit: "read" });
    const { id } = await context.params;
    if (!canAccessSchool(auth, id)) throw notFound("School not found.");

    const data = await findSchoolDetail(id);
    if (!data) throw notFound("School not found.");
    return NextResponse.json({ data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest, context: Context) {
  let auth;
  try {
    auth = await requireAuth(req, { roles: ["admin", "super-admin"], rateLimit: "mutation" });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const { id } = await context.params;
    if (!canAccessSchool(auth, id)) throw notFound("School not found.");

    const body = await parseJson(req, updateSchoolSchema);

    if (auth.role !== "super-admin") {
      const current = await findSchoolSensitiveFields(id);
      if (!current) throw notFound("School not found.");
      if (body.subscription_package !== undefined && !isPackageAllowed(body.subscription_package, current.subscription_package)) {
        throw forbidden(SENSITIVE_DENIED_MESSAGE);
      }
      const changed = findSensitiveSchoolChanges(current, body);
      if (changed.length > 0) throw forbidden(SENSITIVE_DENIED_MESSAGE);
    }

    const { head_name, owner_name, location, ...schoolFields } = body;
    const audit = buildAuditContext(req, auth);
    await updateSchoolRecord(
      id,
      schoolFields,
      { head_name, owner_name, location },
      audit,
      { fields: Object.keys(body) },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  let auth;
  try {
    auth = await requireAuth(request, { roles: ["super-admin"], rateLimit: "mutation", denyImpersonation: true });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const { id } = await context.params;
    const audit = buildAuditContext(request, auth);
    await deleteSchoolRecord(id, audit);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
