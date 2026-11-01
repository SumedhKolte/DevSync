export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Enforce byte limits while reading, including chunked requests without Content-Length. */
export async function readBody(
  request: Request,
  limit = 64 * 1024,
): Promise<string> {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > limit)
    throw new HttpError(413, "Request is too large.");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let size = 0;
  let result = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, "Request is too large.");
      }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    await reader.cancel().catch(() => undefined);
    throw new HttpError(400, "Request body could not be read.");
  } finally {
    reader.releaseLock();
  }
}

export async function readJson(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new HttpError(415, "Use application/json for this request.");
  const body = await readBody(request);
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "Request must contain valid JSON.");
  }
}
