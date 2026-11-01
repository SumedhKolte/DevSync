import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/auth/google/route";
const mocks = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));
vi.mock("../src/lib/server/supabase", async (original) => ({
  ...(await original<typeof import("../src/lib/server/supabase")>()),
  userClient: async () => ({
    auth: { signInWithOAuth: mocks.signInWithOAuth },
  }),
}));
const settingsFetch = vi.fn();
const request = (origin = "https://devsync.test") =>
  new Request("https://devsync.test/auth/google", {
    method: "POST",
    headers: { origin },
  });
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://devsync.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable");
  vi.stubGlobal("fetch", settingsFetch);
  settingsFetch.mockResolvedValue(
    Response.json({ external: { google: true }, disable_signup: false }),
  );
  mocks.signInWithOAuth.mockResolvedValue({
    data: { url: "https://supabase.test/auth/v1/authorize?provider=google" },
    error: null,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("Google sign-in", () => {
  it("sends the browser to Supabase with the app callback", async () => {
    const response = await POST(request());
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://supabase.test/auth/v1/authorize?provider=google",
    );
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://devsync.test/auth/callback",
        queryParams: { prompt: "select_account" },
      },
    });
  });
  it("rejects starts from other sites", async () => {
    const response = await POST(request("https://evil.test"));
    expect(response.headers.get("location")).toBe(
      "https://devsync.test/login?error=oauth",
    );
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });
  it("explains when Google is not enabled in Supabase", async () => {
    settingsFetch.mockResolvedValue(
      Response.json({ external: { google: false } }),
    );
    const response = await POST(request());
    expect(response.headers.get("location")).toBe(
      "https://devsync.test/login?error=google-unavailable",
    );
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });
});
