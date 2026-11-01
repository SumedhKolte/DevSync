import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieOptions } from "./lib/server/http";
export async function proxy(request: NextRequest) {
  // If Supabase falls back to its Site URL after Google sign-in, the code
  // arrives at the home page; finish the exchange at the callback route.
  if (
    request.nextUrl.pathname === "/" &&
    request.nextUrl.searchParams.has("code")
  ) {
    const callback = request.nextUrl.clone();
    callback.pathname = "/auth/callback";
    return NextResponse.redirect(callback);
  }
  let response = NextResponse.next({ request });
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    request.nextUrl.pathname.startsWith("/demo")
  )
    return response;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: sessionCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach((c) => request.cookies.set(c.name, c.value));
          response = NextResponse.next({ request });
          cookies.forEach((c) =>
            response.cookies.set(c.name, c.value, c.options),
          );
        },
      },
    },
  );
  await supabase.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|api/webhooks).*)",
  ],
};
