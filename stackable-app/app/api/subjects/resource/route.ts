import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const path = request.nextUrl.searchParams.get("path");
    if (!path) {
      return NextResponse.json({ error: "path is required." }, { status: 400 });
    }

    const signed = await supabaseAdmin.storage
      .from("subject_resources")
      .createSignedUrl(path, 60 * 10);

    if (signed.error || !signed.data?.signedUrl) {
      return NextResponse.json(
        { error: signed.error?.message ?? "Could not create a signed resource URL." },
        { status: 500 },
      );
    }

    return NextResponse.redirect(signed.data.signedUrl);
  } catch (error) {
    console.error("subject resource proxy route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}
