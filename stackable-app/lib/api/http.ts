// =============================================================================
// Browser HTTP client — one typed way for the UI to call our API.
// -----------------------------------------------------------------------------
// Every page/hook uses these instead of calling fetch() by hand. They send
// cookies, parse JSON, and THROW a clear error when the server says no — so
// TanStack Query can show error states correctly.
// =============================================================================

export class HttpError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function handle<T>(res: Response): Promise<T> {
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new HttpError(
      res.status,
      body?.error ?? `Request failed (${res.status})`,
      body?.code,
      body?.details,
    );
  }
  return body as T;
}

export function apiGet<T>(url: string, signal?: AbortSignal): Promise<T> {
  return fetch(url, { credentials: "same-origin", signal }).then(handle<T>);
}

/** POST/PATCH/PUT/DELETE with a JSON body. */
export function apiSend<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  url: string,
  body?: unknown,
): Promise<T> {
  return fetch(url, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(handle<T>);
}

/** POST a multipart form (file uploads). */
export function apiSendForm<T>(
  method: "POST" | "PATCH",
  url: string,
  form: FormData,
): Promise<T> {
  return fetch(url, { method, credentials: "same-origin", body: form }).then(handle<T>);
}
