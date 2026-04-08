import { NextResponse } from "next/server";
import { getSubjectDetailData } from "@/lib/subjects-server";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const data = await getSubjectDetailData(id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("subject detail route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}
