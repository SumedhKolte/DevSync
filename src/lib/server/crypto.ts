import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
function key() {
  const k = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || "", "base64");
  if (k.length !== 32)
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must contain 32 base64-encoded random bytes.",
    );
  return k;
}
export function encrypt(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function decrypt<T>(value: string): T {
  const [v, iv, tag, data] = value.split(".");
  if (v !== "v1" || !iv || !tag || !data)
    throw new Error("Invalid credential format");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString(),
  ) as T;
}
export function verifyGithubSignature(
  body: string,
  signature: string | null,
  secret: string,
) {
  if (!/^sha256=[a-f0-9]{64}$/.test(signature || "")) return false;
  const expected = Buffer.from(
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex"),
  );
  const actual = Buffer.from(signature!);
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
