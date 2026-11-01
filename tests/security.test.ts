import { afterEach, describe, expect, it, vi } from "vitest";
import { randomBytes, createHmac } from "node:crypto";
import {
  encrypt,
  decrypt,
  verifyGithubSignature,
} from "../src/lib/server/crypto";
afterEach(() => vi.unstubAllEnvs());
describe("credential storage and webhook authentication", () => {
  it("authenticates ciphertext and uses unique nonces", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    const value = { access_token: "private-test-token" };
    const a = encrypt(value),
      b = encrypt(value);
    expect(a).not.toBe(b);
    expect(a).not.toContain(value.access_token);
    expect(decrypt(a)).toEqual(value);
    const parts = a.split(".");
    parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
    expect(() => decrypt(parts.join("."))).toThrow();
  });
  it("rejects missing and invalid encryption keys", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
    expect(() => encrypt("secret")).toThrow(/32/);
  });
  it("verifies signatures over exact request bytes and rejects tampering", () => {
    const body = '{"action":"opened"}';
    const signature =
      "sha256=" +
      createHmac("sha256", "test-secret").update(body).digest("hex");
    expect(verifyGithubSignature(body, signature, "test-secret")).toBe(true);
    expect(verifyGithubSignature(body + " ", signature, "test-secret")).toBe(
      false,
    );
    expect(verifyGithubSignature(body, "bad", "test-secret")).toBe(false);
    expect(verifyGithubSignature(body, null, "test-secret")).toBe(false);
  });
});
