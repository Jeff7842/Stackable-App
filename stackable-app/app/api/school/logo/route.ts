import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guard";
import { toErrorResponse } from "@/lib/api/errors";
import { getPublicUrl, uploadFile } from "@/lib/storage";
import { sniffImageType } from "@/lib/teacher-photo";
import { MAX_LOGO_BYTES } from "@/lib/validation/school-admin";

const SCHOOL_LOGOS_BUCKET = "school_logos";

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req, { roles: ["admin", "super-admin"], rateLimit: "mutation" });
  } catch (err) {
    return toErrorResponse(err);
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing logo file." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Logo file is empty." }, { status: 400 });
    }
    if (file.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "Logo must be 4MB or smaller." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    // Trust the bytes, not the browser's claimed content type.
    const kind = sniffImageType(new Uint8Array(bytes));
    if (!kind) {
      return NextResponse.json({ error: "Logo must be a JPEG, PNG, WebP or GIF image." }, { status: 400 });
    }

    const filePath = `schools/${Date.now()}-${crypto.randomUUID()}.${kind.ext}`;
    const { error } = await uploadFile(SCHOOL_LOGOS_BUCKET, filePath, bytes, {
      contentType: kind.mime,
      ensureBucket: { public: true, fileSizeLimit: MAX_LOGO_BYTES },
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: { path: filePath, url: getPublicUrl(SCHOOL_LOGOS_BUCKET, filePath) },
    });
  } catch (error) {
    console.error("school logo upload route error", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
