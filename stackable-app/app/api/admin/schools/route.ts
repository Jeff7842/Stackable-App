import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { listSchools } from "@/lib/repositories/school.repo";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, { roles: ["admin", "super-admin"], rateLimit: "read" });
  } catch (err) { return toErrorResponse(err); }

  if (process.env.DATA_BACKEND === "prisma") {
    try {
      const schools = await listSchools();
      return NextResponse.json({ schools });
    } catch (error) {
      console.error("admin schools list route error (prisma)", error);
      return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("schools")
    .select("id, name, code, created_at")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ schools: data ?? [] });
}