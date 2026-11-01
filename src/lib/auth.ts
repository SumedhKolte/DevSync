import { z } from "zod";
const emailInput = z.string().trim().pipe(z.email().max(254));
export const authInput = z.object({
  mode: z.literal("signin"),
  email: emailInput,
  password: z.string().min(1).max(128),
});
export const signupInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailInput,
  password: z.string().min(12).max(128),
});
export function authFailure(error: { code?: string; status?: number }) {
  if (error.code === "user_already_exists" || error.code === "email_exists")
    return {
      status: 409,
      code: "account_exists",
      error:
        "An account already uses this email. Sign in with your existing password.",
    };
  if (error.code === "invalid_credentials")
    return {
      status: 401,
      code: "invalid_credentials",
      error:
        "The email or password is incorrect. Please check your details and try again.",
    };
  if (error.code === "email_not_confirmed")
    return {
      status: 403,
      code: "email_not_confirmed",
      error:
        "Your account is not activated yet. Contact your workspace administrator for access.",
    };
  if (error.code === "email_address_not_authorized")
    return {
      status: 503,
      code: "email_delivery",
      error:
        "Email delivery is not available for this address yet. The workspace administrator needs to configure the email service.",
    };
  if (error.code === "over_email_send_rate_limit")
    return {
      status: 429,
      code: "email_rate_limit",
      error:
        "The email service has reached its sending limit. This request did not send an email. Try again later, or sign in with your password. If this continues, the workspace administrator needs to configure email delivery.",
    };
  if (error.status === 429 || error.code?.includes("rate_limit"))
    return {
      status: 429,
      code: "rate_limit",
      error:
        "Too many attempts. Please wait before trying again. The sign-in service has not provided an exact retry time.",
    };
  if (error.code === "same_password")
    return {
      status: 400,
      code: "same_password",
      error: "Choose a password different from your current password.",
    };
  if (error.code === "weak_password")
    return {
      status: 400,
      code: "weak_password",
      error:
        "Choose a stronger password with at least 12 characters. Avoid common or reused passwords.",
    };
  if (error.code === "signup_disabled")
    return {
      status: 403,
      code: "signup_disabled",
      error:
        "New accounts are currently disabled. Contact the workspace administrator.",
    };
  return {
    status: 503,
    code: "auth_unavailable",
    error:
      "Sign-in is temporarily unavailable. Please try again shortly. If this continues, contact the workspace administrator.",
  };
}
export function canonicalLocalUrl(
  requestUrl: string,
  configuredOrigin: string,
): string | null {
  const request = new URL(requestUrl),
    configured = new URL(configuredOrigin);
  const local = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (
    local.has(request.hostname) &&
    local.has(configured.hostname) &&
    request.port === configured.port &&
    request.protocol === configured.protocol &&
    request.origin !== configured.origin
  )
    return configured.origin + request.pathname + request.search;
  return null;
}
