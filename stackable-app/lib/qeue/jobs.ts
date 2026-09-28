// =============================================================================
// Background jobs on QStash — enqueue work, and verify QStash's callback.
// -----------------------------------------------------------------------------
// Slow work (CSV exports, emailing a whole school) must not run inside a page
// request. Instead:
//
//   1. A route calls   enqueueJob("csv-export", { schoolId, ... })
//   2. QStash calls    POST {APP_BASE_URL}/api/jobs/csv-export   (a few seconds later)
//   3. That route runs verifyQStashRequest(req) FIRST, then does the work.
//
// QStash delivers AT LEAST ONCE and retries any non-2xx answer, so every job
// handler must be safe to run twice (idempotent).
//
// QStash calls a PUBLIC url. APP_BASE_URL must therefore be the deployed site or
// a tunnel (ngrok etc.); QStash rejects http://localhost.
//
// Env: QSTASH_TOKEN (publishing, see qstash.ts), QSTASH_CURRENT_SIGNING_KEY and
// QSTASH_NEXT_SIGNING_KEY (verifying), APP_BASE_URL (where jobs are delivered).
// Job handlers are registered in lib/qeue/registry.ts.
// =============================================================================

import { Receiver, SignatureError } from "@upstash/qstash";
import { badRequest, unauthorized } from "@/lib/api/errors";
import { qstash } from "./qstash";

// Lower-case words joined by dashes. This is also what keeps a job name from
// smuggling "/", ".." or "?" into the callback URL.
const JOB_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Queue a job for later. Returns as soon as QStash accepts the message.
 *
 * Why it exists: one place decides the callback URL, so every job lands on
 * /api/jobs/<name> and goes through the same signature check.
 *
 * @param name    job name, e.g. "csv-export"; must match /^[a-z0-9][a-z0-9-]*$/
 * @param payload anything JSON-serialisable (no BigInt or Date instances); it arrives as the handler's argument
 * @param opts.delaySeconds wait this many seconds before delivery (default: immediately)
 * @returns the QStash message id, useful for logs
 * @throws Error when the name is invalid or APP_BASE_URL is missing (programmer/config errors), or when QStash rejects the publish
 */
export async function enqueueJob(
  name: string,
  payload: unknown,
  opts: { delaySeconds?: number } = {},
): Promise<{ messageId?: string }> {
  if (!JOB_NAME_PATTERN.test(name)) {
    throw new Error(`enqueueJob: invalid job name "${name}" (use lower-case letters, digits and dashes)`);
  }
  const baseUrl = process.env.APP_BASE_URL;
  if (!baseUrl) throw new Error("enqueueJob: APP_BASE_URL is not set");

  const { delaySeconds } = opts;
  if (delaySeconds !== undefined && (!Number.isFinite(delaySeconds) || delaySeconds < 0)) {
    throw new Error(`enqueueJob: delaySeconds must be a number >= 0, got ${delaySeconds}`);
  }

  const response = await qstash.publishJSON({
    url: `${baseUrl.replace(/\/+$/, "")}/api/jobs/${name}`,
    body: payload,
    ...(delaySeconds ? { delay: Math.ceil(delaySeconds) } : {}),
  });
  return { messageId: response.messageId };
}

/**
 * Prove that a request really came from QStash and return its JSON body.
 *
 * Why it exists: job URLs are public. Without this anyone could POST to
 * /api/jobs/<name> and trigger exports or emails.
 *
 * Same steps as app/api/jobs/send-otp-email: read the RAW body first (the
 * signature covers those exact bytes), verify it, only then parse the JSON.
 *
 * @param req the incoming job request
 * @returns the parsed JSON body
 * @throws ApiError 401 when the signature is missing or wrong; 400 when the body is not JSON.
 *         A missing signing key is OUR misconfiguration, so that surfaces as a plain Error (500), not a 401.
 */
export async function verifyQStashRequest(req: Request): Promise<{ body: unknown }> {
  const rawBody = await req.text(); // must be read as text, before any parsing

  const signature = req.headers.get("upstash-signature");
  if (!signature) throw unauthorized("Missing signature.");

  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  });
  try {
    // Tries the current key, then the next key (so key rotation never drops jobs).
    await receiver.verify({ signature, body: rawBody });
  } catch (err) {
    if (err instanceof SignatureError) throw unauthorized("Invalid signature.");
    throw err; // e.g. no signing keys configured: not the caller's fault
  }

  try {
    return { body: JSON.parse(rawBody) as unknown };
  } catch {
    // A valid signature with a non-JSON body means whoever enqueued it made a mistake.
    throw badRequest("Job body is not valid JSON.");
  }
}
