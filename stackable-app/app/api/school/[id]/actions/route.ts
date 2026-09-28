import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { buildAuditContext } from "@/lib/api/audit-context";
import { forbidden, notFound, toErrorResponse } from "@/lib/api/errors";
import { parseJson } from "@/lib/api/validate";
import {
  increaseSchoolCapacity,
  regenerateSchoolCode,
  setSchoolStatus,
} from "@/lib/repositories/school-admin.repo";
import { canAccessSchool, canRunSchoolAction, schoolActionSchema } from "@/lib/validation/school-admin";

type Context = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: Context) {
  let auth;
  try {
    auth = await requireAuth(req, { roles: ["admin", "super-admin"], rateLimit: "mutation", denyImpersonation: true });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const { id } = await context.params;
    if (!canAccessSchool(auth, id)) throw notFound("School not found.");

    const { action } = await parseJson(req, schoolActionSchema);
    if (!canRunSchoolAction(auth.role, action)) {
      throw forbidden("Only a super-admin can perform this action.");
    }

    const audit = buildAuditContext(req, auth);

    if (action === "activate") {
      await setSchoolStatus(id, "active", audit);
      return NextResponse.json({ ok: true, message: "School activated successfully." });
    }
    if (action === "suspend") {
      await setSchoolStatus(id, "suspended", audit);
      return NextResponse.json({ ok: true, message: "School suspended successfully." });
    }
    if (action === "increase_capacity_50") {
      await increaseSchoolCapacity(id, audit);
      return NextResponse.json({ ok: true, message: "School capacity increased by 50 users." });
    }
    // action === "regenerate_code" (schoolActionSchema only allows these four values)
    await regenerateSchoolCode(id, audit);
    return NextResponse.json({ ok: true, message: "School code regenerated successfully." });
  } catch (error) {
    return toErrorResponse(error);
  }
}
