import type { cookies } from "next/headers";
type CookieJar = Awaited<ReturnType<typeof cookies>>;
// Browsers silently drop cookies over ~4 KB, and encrypted Atlassian tokens
// exceed that, so the pending authorization is split across several cookies.
const CHUNK_SIZE = 3000;
const MAX_CHUNKS = 5;
const chunkName = (provider: string, index: number) =>
  `devsync_pending_${provider}_${index}`;
export function setPendingTokens(
  jar: CookieJar,
  provider: string,
  value: string,
  options: { secure: boolean },
) {
  const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) || [];
  if (chunks.length > MAX_CHUNKS)
    throw new Error("Provider authorization is too large to hold.");
  for (let index = 0; index < MAX_CHUNKS; index++) {
    if (index < chunks.length)
      jar.set(chunkName(provider, index), chunks[index], {
        httpOnly: true,
        secure: options.secure,
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      });
    else if (jar.get(chunkName(provider, index)))
      jar.delete(chunkName(provider, index));
  }
}
export function getPendingTokens(jar: CookieJar, provider: string) {
  let value = "";
  for (let index = 0; index < MAX_CHUNKS; index++) {
    const chunk = jar.get(chunkName(provider, index))?.value;
    if (!chunk) break;
    value += chunk;
  }
  return value || undefined;
}
export function clearPendingTokens(jar: CookieJar, provider: string) {
  for (let index = 0; index < MAX_CHUNKS; index++)
    if (jar.get(chunkName(provider, index)))
      jar.delete(chunkName(provider, index));
}
