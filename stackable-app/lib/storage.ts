// =============================================================================
// File storage - the ONE module that talks to object storage.
// -----------------------------------------------------------------------------
// Today the files (teacher photos, school logos, subject resources) live in
// Supabase Storage. The database is Prisma + plain PostgreSQL; storage is NOT the
// database, so it may stay on Supabase for now. Every upload / download / delete /
// URL in the app goes through the functions below, so moving to Cloudflare R2,
// MinIO or a folder on the VPS later means rewriting THIS FILE ONLY (keep the
// exported names and result shapes).
//
// Rules for callers:
//   - never import @supabase/* or lib/supabase/* anywhere else for storage;
//   - functions never throw for a storage failure: they return `{ error }` with the
//     provider's message (log it server-side, show a friendly message to users);
//   - SERVER-ONLY (uses the service-role key). Never import from a client component.
//   - the client is created lazily, so importing this file never crashes a build
//     when the env vars are absent.
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type StorageBody = ArrayBuffer | Uint8Array | Blob;

export type BucketOptions = {
  /** Public buckets serve objects by plain URL; private ones need a signed URL. */
  public?: boolean;
  /** Reject objects bigger than this many bytes at the storage layer. */
  fileSizeLimit?: number;
};

export type StorageResult = { error: string | null };

let client: SupabaseClient | null = null;

/** Lazily create the storage client. Returns null when storage is not configured. */
function getClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

const NOT_CONFIGURED = "File storage is not configured.";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Make sure a bucket exists (creates it when missing).
 * @param bucket bucket name
 * @param options visibility and size cap used only when the bucket has to be created
 */
export async function ensureBucket(
  bucket: string,
  options: BucketOptions = {},
): Promise<StorageResult> {
  const sb = getClient();
  if (!sb) return { error: NOT_CONFIGURED };
  try {
    const existing = await sb.storage.getBucket(bucket);
    if (!existing.error && existing.data) return { error: null };

    const created = await sb.storage.createBucket(bucket, {
      public: options.public ?? false,
      ...(options.fileSizeLimit ? { fileSizeLimit: options.fileSizeLimit } : {}),
    });
    if (created.error && !created.error.message.toLowerCase().includes("already exists")) {
      return { error: created.error.message };
    }
    return { error: null };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/**
 * Upload one object.
 * @param bucket bucket name
 * @param path object path inside the bucket (server-generated, never raw user input)
 * @param body file bytes
 * @param opts contentType (required), upsert (default false), ensureBucket (create the bucket first)
 */
export async function uploadFile(
  bucket: string,
  path: string,
  body: StorageBody,
  opts: { contentType: string; upsert?: boolean; ensureBucket?: BucketOptions },
): Promise<StorageResult> {
  const sb = getClient();
  if (!sb) return { error: NOT_CONFIGURED };
  try {
    if (opts.ensureBucket) {
      const ensured = await ensureBucket(bucket, opts.ensureBucket);
      if (ensured.error) return ensured;
    }
    const { error } = await sb.storage.from(bucket).upload(path, body, {
      contentType: opts.contentType,
      upsert: opts.upsert ?? false,
    });
    return { error: error ? error.message : null };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/** Delete objects. Missing objects are not an error. */
export async function removeFiles(bucket: string, paths: string[]): Promise<StorageResult> {
  if (paths.length === 0) return { error: null };
  const sb = getClient();
  if (!sb) return { error: NOT_CONFIGURED };
  try {
    const { error } = await sb.storage.from(bucket).remove(paths);
    return { error: error ? error.message : null };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/**
 * The plain URL of an object in a PUBLIC bucket.
 * @returns the URL, or "" when storage is not configured
 */
export function getPublicUrl(bucket: string, path: string): string {
  const sb = getClient();
  if (!sb) return "";
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * A temporary URL for an object in a PRIVATE bucket.
 * @param expiresInSeconds how long the URL works
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number,
): Promise<{ url: string | null; error: string | null }> {
  const sb = getClient();
  if (!sb) return { url: null, error: NOT_CONFIGURED };
  try {
    const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) return { url: null, error: error?.message ?? "No URL returned." };
    return { url: data.signedUrl, error: null };
  } catch (err) {
    return { url: null, error: errorMessage(err) };
  }
}

/** Download an object's bytes (used by routes that stream a private file through the app). */
export async function downloadFile(
  bucket: string,
  path: string,
): Promise<{ data: ArrayBuffer | null; contentType: string | null; error: string | null }> {
  const sb = getClient();
  if (!sb) return { data: null, contentType: null, error: NOT_CONFIGURED };
  try {
    const { data, error } = await sb.storage.from(bucket).download(path);
    if (error || !data) return { data: null, contentType: null, error: error?.message ?? "Not found." };
    return { data: await data.arrayBuffer(), contentType: data.type || null, error: null };
  } catch (err) {
    return { data: null, contentType: null, error: errorMessage(err) };
  }
}
