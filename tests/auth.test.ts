import { describe, expect, it } from "vitest";
import { authFailure, authInput, canonicalLocalUrl } from "../src/lib/auth";
describe("account entry boundaries", () => {
  it("normalizes local host aliases without redirecting external hosts", () => {
    expect(
      canonicalLocalUrl(
        "http://localhost:3000/login?error=invalid-link",
        "http://127.0.0.1:3000",
      ),
    ).toBe("http://127.0.0.1:3000/login?error=invalid-link");
    expect(
      canonicalLocalUrl("https://evil.example/login", "http://127.0.0.1:3000"),
    ).toBeNull();
    expect(
      canonicalLocalUrl("http://localhost:4000/login", "http://127.0.0.1:3000"),
    ).toBeNull();
    expect(
      canonicalLocalUrl(
        "https://localhost:3000/login",
        "http://127.0.0.1:3000",
      ),
    ).toBeNull();
  });
  it("accepts existing passwords and rejects email-sending or signup modes", () => {
    for (const mode of ["signup", "magic", "recover", "resend"]) {
      expect(
        authInput.safeParse({
          mode,
          email: "test@example.com",
          password: "valid-long-password",
        }).success,
      ).toBe(false);
    }
    expect(
      authInput.safeParse({
        mode: "signin",
        email: "test@example.com",
        password: "short",
      }).success,
    ).toBe(true);
    expect(
      authInput.safeParse({ mode: "signin", email: "test@example.com" })
        .success,
    ).toBe(false);
    expect(
      authInput.safeParse({ mode: "bypass", email: "test@example.com" })
        .success,
    ).toBe(false);
  });
  it("distinguishes invalid credentials, confirmation, SMTP restrictions and rate limits", () => {
    expect(authFailure({ code: "invalid_credentials" }).status).toBe(401);
    expect(authFailure({ code: "email_not_confirmed" }).code).toBe(
      "email_not_confirmed",
    );
    expect(authFailure({ code: "email_address_not_authorized" }).code).toBe(
      "email_delivery",
    );
    expect(authFailure({ status: 429 }).status).toBe(429);
    expect(authFailure({ status: 500 }).status).toBe(503);
  });
  it("does not promise a one-minute reset for an email quota or unknown rate limit", () => {
    const emailLimit = authFailure({
      code: "over_email_send_rate_limit",
      status: 429,
    });
    expect(emailLimit.code).toBe("email_rate_limit");
    expect(emailLimit.error).toContain("did not send an email");
    expect(emailLimit.error).not.toContain("minute");
    const requestLimit = authFailure({
      code: "over_request_rate_limit",
      status: 429,
    });
    expect(requestLimit.code).toBe("rate_limit");
    expect(requestLimit.error).toContain("not provided an exact retry time");
  });
});
