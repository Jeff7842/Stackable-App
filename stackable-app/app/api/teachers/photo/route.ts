import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TEACHERS_PROFILE_BUCKET } from "@/lib/teachers";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse, notFound } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireAuth(request, { rateLimit: "read" });
  } catch (err) { return toErrorResponse(err); }

  try {
    const filePath = request.nextUrl.searchParams.get("path")?.trim();

    if (!filePath) {
      return NextResponse.json(
        { error: "Missing teacher photo path." },
        { status: 400 },
      );
    }

    // Storage paths are: teachers/{teacherId}/...
    // Extract the teacher ID and verify it belongs to the caller's school.
    const pathParts = filePath.split("/");
    const teacherId = pathParts[1]; // index 0 = "teachers", index 1 = UUID
    if (!teacherId) {
      return toErrorResponse(notFound());
    }

    const { data: teacherRow, error: teacherError } = await supabaseAdmin
      .from("teachers")
      .select("school_id")
      .eq("id", teacherId)
      .maybeSingle();

    if (teacherError || !teacherRow || teacherRow.school_id !== ctx.schoolId) {
      return toErrorResponse(notFound());
    }

    const { data, error } = await supabaseAdmin.storage
      .from(TEACHERS_PROFILE_BUCKET)
      .download(filePath);

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Teacher photo not found." },
        { status: 404 },
      );
    }

    const arrayBuffer = await data.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": data.type || "application/octet-stream",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("teacher photo route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}
