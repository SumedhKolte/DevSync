import { NextResponse } from "next/server";
import { appOrigin, HttpError } from "./supabase";
// 303 so a failed form POST lands on the page with a GET.
export function connectionErrorRedirect(error: unknown, detail?: string) {
  if (error instanceof HttpError && error.status === 401)
    return NextResponse.redirect(`${appOrigin()}/login`, 303);
  const reason =
    error instanceof HttpError && error.status === 503
      ? "configuration"
      : "authorization";
  const url = new URL("/connect/error", appOrigin());
  url.searchParams.set("reason", reason);
  if (detail) url.searchParams.set("detail", detail.slice(0, 200));
  return NextResponse.redirect(url, 303);
}
