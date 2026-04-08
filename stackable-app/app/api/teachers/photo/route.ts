import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TEACHERS_PROFILE_BUCKET } from "@/lib/teachers";

export async function GET(request: NextRequest) {
  try {
    const filePath = request.nextUrl.searchParams.get("path")?.trim();

    if (!filePath) {
      return NextResponse.json(
        { error: "Missing teacher photo path." },
        { status: 400 },
      );
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
