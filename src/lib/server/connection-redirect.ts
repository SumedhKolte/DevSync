import { NextResponse } from "next/server";
import { appOrigin, HttpError } from "./supabase";
// 303 so a failed form POST lands on the page with a GET.
export function connectionErrorRedirect(error: unknown) {
  if (error instanceof HttpError && error.status === 401)
    return NextResponse.redirect(`${appOrigin()}/login`, 303);
  const reason =
    error instanceof HttpError && error.status === 503
      ? "configuration"
      : "authorization";
  return NextResponse.redirect(
    `${appOrigin()}/connect/error?reason=${reason}`,
    303,
  );
}
