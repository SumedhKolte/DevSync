import { HttpError } from "./supabase";

// Check public Auth settings before signup so this password-only flow never
// knowingly requests an undeliverable confirmation email.
export async function assertPasswordSignupEnabled() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new HttpError(503, "Account creation is not configured yet.");
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw new HttpError(
      503,
      "Account creation is temporarily unavailable. Please try again.",
    );
  const settings = await response.json();
  if (settings.disable_signup || settings.external?.email !== true)
    throw new HttpError(
      503,
      "Account creation is currently disabled. Contact your workspace administrator.",
    );
  if (settings.mailer_autoconfirm !== true)
    throw new HttpError(
      503,
      "Password sign-up needs one setup change: the workspace administrator must turn off Confirm email in Supabase Authentication settings. No account was created and no email was sent.",
    );
}

/** True when the Supabase project accepts Google as a sign-in provider. */
export async function googleSignInEnabled() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return false;
  const settings = await response.json();
  return settings.external?.google === true && !settings.disable_signup;
}
