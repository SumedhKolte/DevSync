import { providerFetch, type ConnectionRow } from "./providers";
export async function ensureJiraWebhook(c: ConnectionRow, token: string) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || "";
  if (!origin.startsWith("https://"))
    return {
      warning:
        "Webhooks need a public HTTPS app URL. Scheduled reconciliation remains available.",
    };
  const base = `https://api.atlassian.com/ex/jira/${c.config.cloud_id}/rest/api/3/webhook`;
  const scope = c.resources
    .map((r) => r.id)
    .sort()
    .join(",");
  if (c.config.webhook_ids?.length && c.config.webhook_scope !== scope) {
    await providerFetch(base, token, {
      method: "DELETE",
      body: JSON.stringify({ webhookIds: c.config.webhook_ids }),
    });
    c = {
      ...c,
      config: { ...c.config, webhook_ids: [], webhook_expires_at: undefined },
    };
  }
  if (
    c.config.webhook_ids?.length &&
    (c.config.webhook_expires_at || 0) > Date.now() + 7 * 86400000
  )
    return { config: c.config };
  if (c.config.webhook_ids?.length) {
    const { data } = await providerFetch<{ expirationDate: number }>(
      base,
      token,
      {
        method: "PUT",
        body: JSON.stringify({ webhookIds: c.config.webhook_ids }),
      },
    );
    return { config: { ...c.config, webhook_expires_at: data.expirationDate } };
  }
  const projectIds = c.resources.map((r) => r.id);
  if (!projectIds.length || projectIds.some((id) => !/^\d+$/.test(id)))
    return {};
  const { data } = await providerFetch<{
    webhookRegistrationResult: {
      createdWebhookId?: number;
      errors?: string[];
    }[];
  }>(base, token, {
    method: "POST",
    body: JSON.stringify({
      url: `${origin.replace(/\/$/, "")}/api/webhooks/jira/${c.id}`,
      webhooks: [
        {
          events: [
            "jira:issue_created",
            "jira:issue_updated",
            "jira:issue_deleted",
          ],
          jqlFilter: `project in (${projectIds.join(",")})`,
        },
      ],
    }),
  });
  const ids = data.webhookRegistrationResult.flatMap((r) =>
    r.createdWebhookId ? [r.createdWebhookId] : [],
  );
  if (!ids.length)
    return {
      warning:
        "Jira webhook registration was not accepted. Check scopes and app distribution; reconciliation remains available.",
    };
  return {
    config: {
      ...c.config,
      webhook_ids: ids,
      webhook_expires_at: Date.now() + 30 * 86400000,
      webhook_scope: scope,
    },
  };
}
