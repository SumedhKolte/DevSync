import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/auth/signup/route";
const mocks = vi.hoisted(() => ({ signUp: vi.fn() }));
vi.mock("../src/lib/server/supabase", async (original) => ({
  ...(await original<typeof import("../src/lib/server/supabase")>()),
  userClient: async () => ({ auth: { signUp: mocks.signUp } }),
}));
const settingsFetch = vi.fn();
function request(body: unknown, origin = "https://devsync.test") {
  return new Request("https://devsync.test/auth/signup", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const account = {
  name: "Test User",
  email: "new@example.test",
  password: "a-long-test-password",
};
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://devsync.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable");
  vi.stubGlobal("fetch", settingsFetch);
  settingsFetch.mockResolvedValue(
    Response.json({
      external: { email: true },
      disable_signup: false,
      mailer_autoconfirm: true,
    }),
  );
  mocks.signUp.mockResolvedValue({
    data: { session: { access_token: "fixture" } },
    error: null,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
describe("password-only signup", () => {
  it("creates a password account and starts a session through Supabase", async () => {
    const response = await POST(request(account));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ signedIn: true });
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: account.email,
      password: account.password,
      options: { data: { full_name: account.name } },
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("does not create an account or send email while confirmation is enabled", async () => {
    settingsFetch.mockResolvedValue(
      Response.json({ external: { email: true }, mailer_autoconfirm: false }),
    );
    const response = await POST(request(account));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("No account was created");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("fails closed when auth settings cannot be checked", async () => {
    settingsFetch.mockResolvedValue(new Response(null, { status: 503 }));
    expect((await POST(request(account))).status).toBe(503);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("rejects other origins before inspecting settings", async () => {
    expect(
      (await POST(request(account, "https://elsewhere.test"))).status,
    ).toBe(403);
    expect(settingsFetch).not.toHaveBeenCalled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("rejects short passwords before contacting Supabase", async () => {
    expect(
      (await POST(request({ ...account, password: "short" }))).status,
    ).toBe(400);
    expect(settingsFetch).not.toHaveBeenCalled();
  });
  it("handles existing accounts without overwriting credentials", async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null },
      error: { code: "user_already_exists" },
    });
    const response = await POST(request(account));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("account_exists");
  });
});
