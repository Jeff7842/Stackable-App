import crypto from "crypto";

type SchoolConfirmationPayload = {
  schoolId: string;
  email: string;
  expiresAt: string;
};

export type SchoolSecurityCodeLabel =
  | "BILLING_AUTH"
  | "STAFF_RESET_AUTH"
  | "RESULTS_RELEASE_AUTH"
  | "HIGH_RISK_DELETE_AUTH"
  | "OWNERSHIP_TRANSFER_AUTH";

export type SchoolSecurityCodeEntry = {
  label: SchoolSecurityCodeLabel;
  code: string;
};

type SchoolPdfPayload = {
  schoolName: string;
  schoolCode: string;
  schoolEmail: string | null;
  codes: SchoolSecurityCodeEntry[];
  generatedAt: string;
};

export const SCHOOL_SECURITY_CODE_LABELS: SchoolSecurityCodeLabel[] = [
  "BILLING_AUTH",
  "STAFF_RESET_AUTH",
  "RESULTS_RELEASE_AUTH",
  "HIGH_RISK_DELETE_AUTH",
  "OWNERSHIP_TRANSFER_AUTH",
];

function getSchoolSecret() {
  return (
    process.env.SCHOOL_SECURITY_CODES_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "stackable-school-security-secret"
  );
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", getSchoolSecret())
    .update(value)
    .digest("base64url");
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function hashSchoolSecurityCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function generateSchoolCode(name: string, salt = crypto.randomUUID()) {
  const prefix = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(4, "X");
  const suffix = crypto
    .createHash("sha256")
    .update(`${name}:${salt}`)
    .digest("hex")
    .toUpperCase()
    .slice(0, 4);

  return `${prefix}-${suffix}`;
}

export function generateSchoolSecurityCode(
  schoolId: string,
  label: SchoolSecurityCodeLabel,
) {
  const digest = crypto
    .createHmac("sha256", getSchoolSecret())
    .update(`school-security:${schoolId}:${label}`)
    .digest("hex")
    .toUpperCase();

  return `${digest.slice(0, 4)}-${digest.slice(4, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}`;
}

export function buildSchoolSecurityCodeEntries(
  schoolId: string,
  labels = SCHOOL_SECURITY_CODE_LABELS,
) {
  return labels.map((label) => ({
    label,
    code: generateSchoolSecurityCode(schoolId, label),
  }));
}

export function buildSchoolSecurityCodeRows(
  schoolId: string,
  createdBy?: string | null,
) {
  return buildSchoolSecurityCodeEntries(schoolId).map((entry) => ({
    school_id: schoolId,
    code_label: entry.label,
    code_hash: hashSchoolSecurityCode(entry.code),
    is_active: true,
    used_count: 0,
    last_used_at: null,
    created_by: createdBy ?? null,
  }));
}

export function formatSchoolSecurityCodeLabel(label: SchoolSecurityCodeLabel) {
  return label
    .toLowerCase()
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export function createSchoolEmailConfirmationToken(
  payload: SchoolConfirmationPayload,
) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySchoolEmailConfirmationToken(token: string) {
  if (!token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || sign(encodedPayload) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload),
    ) as SchoolConfirmationPayload;

    if (!payload.schoolId || !payload.email || !payload.expiresAt) {
      return null;
    }

    if (new Date(payload.expiresAt).getTime() < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function buildSchoolSecurityCodesPdf({
  schoolName,
  schoolCode,
  schoolEmail,
  codes,
  generatedAt,
}: SchoolPdfPayload) {
  const lines = [
    "Stackable School Security Codes",
    "",
    `School: ${schoolName}`,
    `School Code: ${schoolCode}`,
    `School Email: ${schoolEmail || "Not set"}`,
    `Generated: ${generatedAt}`,
    "",
    "Keep these codes in a secure offline location.",
    "Each code should be treated as sensitive recovery information.",
    "",
    ...codes.map(
      (entry) => `${formatSchoolSecurityCodeLabel(entry.label)}: ${entry.code}`,
    ),
  ];

  const streamLines = ["BT", "/F1 20 Tf", "48 800 Td"];

  lines.forEach((line, index) => {
    if (index === 0) {
      streamLines.push(`(${escapePdfText(line)}) Tj`);
      streamLines.push("0 -26 Td");
      streamLines.push("/F1 12 Tf");
      return;
    }

    streamLines.push(`(${escapePdfText(line)}) Tj`);
    streamLines.push("0 -18 Td");
  });

  streamLines.push("ET");

  const contentStream = streamLines.join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((objectText) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += objectText;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  offsets.forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
