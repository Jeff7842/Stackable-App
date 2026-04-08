import { NextRequest, NextResponse } from "next/server";
import {
  buildSubjectResourcePath,
  ensureSubjectResourcesBucket,
  getSchoolSubjectOrThrow,
  getSubjectCourseworkData,
} from "@/lib/subjects-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Context = {
  params: Promise<{ id: string }>;
};

type CourseworkPatchBody =
  | {
      action: "toggle_visibility";
      resource_id: string;
      next_visibility: string;
      changed_by?: string | null;
    }
  | {
      action: "update_progress";
      school_subject_class_id: string;
      current_node_id?: string | null;
      syllabus_progress_pct?: number | null;
    };

function asText(value: FormDataEntryValue | null | undefined) {
  const text = String(value ?? "").trim();
  return text || null;
}

function asNumber(value: FormDataEntryValue | null | undefined) {
  const parsed = Number(asText(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(_: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const data = await getSubjectCourseworkData(id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("subject coursework route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const offering = await getSchoolSubjectOrThrow(id);
    const formData = await request.formData();
    const action = asText(formData.get("action"));

    if (action === "create_topic") {
      const schoolSubjectClassId = asText(formData.get("school_subject_class_id"));
      const title = asText(formData.get("title"));
      const parentId = asText(formData.get("parent_id"));
      const nodeType = asText(formData.get("node_type")) ?? "topic";
      const sortOrder = asNumber(formData.get("sort_order")) ?? 0;

      if (!schoolSubjectClassId || !title) {
        return NextResponse.json(
          { error: "Class offering and topic title are required." },
          { status: 400 },
        );
      }

      let depth = 0;
      if (parentId) {
        const parentRes = await supabaseAdmin
          .from("subject_curriculum_nodes")
          .select("depth")
          .eq("id", parentId)
          .maybeSingle();
        if (parentRes.error) {
          return NextResponse.json({ error: parentRes.error.message }, { status: 500 });
        }
        depth = Number(parentRes.data?.depth ?? 0) + 1;
      }

      const insertRes = await supabaseAdmin.from("subject_curriculum_nodes").insert({
        school_subject_class_id: schoolSubjectClassId,
        parent_id: parentId,
        title,
        node_type: nodeType,
        sort_order: sortOrder,
        depth,
      });

      if (insertRes.error) {
        return NextResponse.json({ error: insertRes.error.message }, { status: 500 });
      }
    } else if (action === "create_resource") {
      const schoolSubjectClassId = asText(formData.get("school_subject_class_id"));
      const title = asText(formData.get("title"));
      const resourceType = asText(formData.get("resource_type")) ?? "document";
      const visibility = asText(formData.get("visibility")) ?? "private";
      const file = formData.get("file");
      const sourceUrl = asText(formData.get("source_url"));

      if (!schoolSubjectClassId || !title) {
        return NextResponse.json(
          { error: "Class offering and resource title are required." },
          { status: 400 },
        );
      }

      const classLinkRes = await supabaseAdmin
        .from("school_subject_classes")
        .select("id, class_id")
        .eq("id", schoolSubjectClassId)
        .maybeSingle();

      if (classLinkRes.error || !classLinkRes.data) {
        return NextResponse.json(
          { error: classLinkRes.error?.message ?? "Class offering not found." },
          { status: 404 },
        );
      }

      let storagePath: string | null = null;

      if (file instanceof File && file.size > 0) {
        await ensureSubjectResourcesBucket();
        storagePath = buildSubjectResourcePath({
          schoolId: offering.school_id,
          subjectId: offering.subject_id,
          classId: classLinkRes.data.class_id,
          filename: file.name,
        });
        const uploadRes = await supabaseAdmin.storage
          .from("subject_resources")
          .upload(storagePath, await file.arrayBuffer(), {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadRes.error) {
          return NextResponse.json({ error: uploadRes.error.message }, { status: 500 });
        }
      }

      const insertRes = await supabaseAdmin.from("subject_resources").insert({
        school_subject_class_id: schoolSubjectClassId,
        curriculum_node_id: asText(formData.get("curriculum_node_id")),
        resource_type: resourceType,
        title,
        short_description: asText(formData.get("short_description")),
        author_name: asText(formData.get("author_name")),
        cover_image_url: asText(formData.get("cover_image_url")),
        storage_path: storagePath,
        source_url: sourceUrl,
        visibility,
        uploaded_by: asText(formData.get("uploaded_by")),
        uploaded_at: new Date().toISOString(),
      });

      if (insertRes.error) {
        return NextResponse.json({ error: insertRes.error.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "Unsupported coursework action." }, { status: 400 });
    }

    const data = await getSubjectCourseworkData(id);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    console.error("subject coursework create route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as CourseworkPatchBody;

    if (body.action === "toggle_visibility") {
      const currentResource = await supabaseAdmin
        .from("subject_resources")
        .select("id, visibility")
        .eq("id", body.resource_id)
        .maybeSingle();

      if (currentResource.error || !currentResource.data) {
        return NextResponse.json(
          { error: currentResource.error?.message ?? "Resource not found." },
          { status: 404 },
        );
      }

      const updateRes = await supabaseAdmin
        .from("subject_resources")
        .update({ visibility: body.next_visibility })
        .eq("id", body.resource_id);

      if (updateRes.error) {
        return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
      }

      await supabaseAdmin.from("subject_resource_visibility_events").insert({
        resource_id: body.resource_id,
        previous_visibility: currentResource.data.visibility,
        next_visibility: body.next_visibility,
        changed_by: body.changed_by ?? null,
      });
    }

    if (body.action === "update_progress") {
      const upsertRes = await supabaseAdmin.from("subject_class_progress").upsert(
        {
          school_subject_class_id: body.school_subject_class_id,
          current_node_id: body.current_node_id ?? null,
          syllabus_progress_pct: body.syllabus_progress_pct ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "school_subject_class_id" },
      );

      if (upsertRes.error) {
        return NextResponse.json({ error: upsertRes.error.message }, { status: 500 });
      }
    }

    const data = await getSubjectCourseworkData(id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("subject coursework patch route error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error." },
      { status: 500 },
    );
  }
}
