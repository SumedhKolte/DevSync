import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dashboard, type View } from "../src/components/dashboard";
import { Login } from "../src/components/login";
import { getDemoData } from "../src/lib/demo";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => null,
}));
afterEach(() => vi.useRealTimers());
describe("server-rendered product contracts", () => {
  it.each<View>([
    "overview",
    "work-items",
    "pull-requests",
    "evidence",
    "activity",
    "connections",
    "settings",
    "repositories",
    "sprints",
  ])("renders %s with valid workspace navigation", (view) => {
    const html = renderToStaticMarkup(
      createElement(Dashboard, { data: getDemoData(), view }),
    );
    expect(html).toContain('id="workspace-content"');
    expect(html).toContain('href="#workspace-content"');
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("undefined");
  });
  it("shows advisory notes on healthy connections without error styling", () => {
    const data = getDemoData();
    const [connected, failed] = data.connections;
    const html = renderToStaticMarkup(
      createElement(Dashboard, {
        data: {
          ...data,
          mode: "live",
          connections: [
            { ...connected, error: "Webhooks need a public HTTPS app URL." },
            { ...failed, status: "error", error: "Authorization expired." },
          ],
        },
        view: "connections",
      }),
    );
    expect(html).toMatch(
      /class="connection-note" role="note">Webhooks need a public HTTPS app URL\./,
    );
    expect(html).toMatch(
      /class="connection-error" role="alert">Authorization expired\./,
    );
  });
  it("uses the same snapshot when rendering on different clocks", () => {
    const data = getDemoData();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(data.asOf));
    const first = renderToStaticMarkup(
      createElement(Dashboard, { data, view: "overview" }),
    );
    vi.setSystemTime(new Date(Date.parse(data.asOf) + 86400000));
    expect(
      renderToStaticMarkup(
        createElement(Dashboard, { data, view: "overview" }),
      ),
    ).toBe(first);
  });
  it("renders a new live workspace without fake metrics or demo data", () => {
    const data = getDemoData();
    data.mode = "live";
    data.items = [];
    data.pullRequests = [];
    data.activities = [];
    data.connections = [];
    data.syncRuns = [];
    data.sprints = [];
    data.repositories = [];
    const html = renderToStaticMarkup(
      createElement(Dashboard, { data, view: "overview" }),
    );
    expect(html).toContain("No current signals");
    expect(html).not.toContain("ENG-138");
    expect(html).not.toContain("NaN");
  });
  it("shows stale source warnings without claiming current data", () => {
    const data = getDemoData();
    data.mode = "live";
    data.connections[0].lastSync = new Date(
      Date.parse(data.asOf) - 3600000,
    ).toISOString();
    const html = renderToStaticMarkup(
      createElement(Dashboard, { data, view: "connections" }),
    );
    expect(html).toContain("Sync overdue");
    expect(html).toContain("Totals may be incomplete");
    expect(html).toContain("Sync history");
  });
  it("offers password sign-in without email delivery controls", () => {
    const html = renderToStaticMarkup(
      createElement(Login, { configured: true }),
    );
    expect(html).toContain('autoComplete="username"');
    expect(html).not.toContain("Use an email sign-in link");
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/forgot-password"');
  });
  it("renders a separate signup form with password confirmation", () => {
    const html = renderToStaticMarkup(
      createElement(Login, { configured: true, mode: "signup" }),
    );
    expect(html).toContain("Create your account");
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain('id="confirm-password"');
    expect(html).toContain('href="/login"');
    expect(html).not.toContain("email sign-in link");
  });
  it.each<View>(["work-items", "pull-requests", "repositories", "sprints"])(
    "offers an actionable connection link in empty %s",
    (view) => {
      const data = getDemoData();
      Object.assign(data, {
        mode: "live",
        items: [],
        pullRequests: [],
        repositories: [],
        sprints: [],
        connections: [],
      });
      const html = renderToStaticMarkup(
        createElement(Dashboard, { data, view }),
      );
      expect(html).toContain('href="/connections"');
      expect(html).not.toContain("NaN");
    },
  );
});
