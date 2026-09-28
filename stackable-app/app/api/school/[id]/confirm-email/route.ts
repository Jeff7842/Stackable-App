import { NextRequest, NextResponse } from "next/server";
import { confirmPendingSchool, findSchoolForConfirmation } from "@/lib/repositories/school-admin.repo";
import { verifySchoolEmailConfirmationToken } from "@/lib/school-security";

type Context = { params: Promise<{ id: string }> };

function renderHtml(title: string, message: string, success: boolean) {
  const accent = success ? "#047857" : "#dc2626";
  const soft = success ? "#ecfdf5" : "#fef2f2";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body { margin:0; padding:32px; font-family: Arial, sans-serif; background:#f6f6f6; color:#111827; }
      .card { max-width:640px; margin:72px auto; background:#fff; border-radius:28px; padding:32px; box-shadow:0 30px 70px rgba(15,23,42,.12); }
      .badge { display:inline-flex; padding:10px 14px; border-radius:999px; background:${soft}; color:${accent}; font-weight:700; margin-bottom:18px; }
      h1 { margin:0 0 12px; font-size:28px; }
      p { margin:0; line-height:1.7; color:#4b5563; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">${success ? "Email Confirmed" : "Confirmation Failed"}</div>
      <h1>${title}</h1>
      <p>${message}</p>
    </div>
  </body>
</html>`;
}

function page(title: string, message: string, success: boolean, status: number) {
  return new NextResponse(renderHtml(title, message, success), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: NextRequest, context: Context) {
  const { id } = await context.params;
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const payload = verifySchoolEmailConfirmationToken(token);

  if (!payload || payload.schoolId !== id) {
    return page(
      "Invalid confirmation link",
      "This school confirmation link is invalid or expired. Ask an administrator to create the school again or resend confirmation.",
      false,
      400,
    );
  }

  const school = await findSchoolForConfirmation(id);
  if (!school) {
    return page(
      "School not found",
      "We could not find this school record anymore. Please contact your Stackable administrator.",
      false,
      404,
    );
  }

  if ((school.email ?? "").toLowerCase() !== payload.email.toLowerCase()) {
    return page(
      "Email mismatch",
      "This confirmation link no longer matches the current school email address.",
      false,
      400,
    );
  }

  const outcome = await confirmPendingSchool(id);
  if (outcome === "blocked") {
    return page(
      "Could not confirm email",
      "This school is suspended, so an old confirmation link can no longer activate it. Please contact your Stackable administrator.",
      false,
      409,
    );
  }

  return page(
    "School email confirmed",
    `${school.name} is now confirmed and can move forward as an active school in Stackable.`,
    true,
    200,
  );
}
