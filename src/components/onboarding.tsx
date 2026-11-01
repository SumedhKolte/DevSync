import Link from "next/link";
import { ArrowRight, Check, Github, Plug, RefreshCw } from "lucide-react";
import type { WorkspaceData } from "@/lib/types";
export function Onboarding({ data }: { data: WorkspaceData }) {
  if (data.mode !== "live") return null;
  const github = data.connections.find((c) => c.provider === "github"),
    jira = data.connections.find((c) => c.provider === "jira");
  const imported =
    !!github &&
    !!jira &&
    [github, jira].every(
      (c) => c.status === "connected" && c.resources.length > 0 && !!c.lastSync,
    );
  if (imported) return null;
  return (
    <section className="onboarding-panel" aria-label="Workspace setup">
      <div className="onboarding-heading">
        <div>
          <span className="eyebrow">MAKE THIS WORKSPACE YOURS</span>
          <h2>Bring your first project into focus</h2>
          <p>
            Connect your accounts, choose the work to follow, and we’ll build
            the shared picture.
          </p>
        </div>
        <span>
          {Number(!!github) + Number(!!jira) + Number(imported)} / 3 steps
        </span>
      </div>
      <div className="onboarding-steps">
        {[
          {
            name: "Connect GitHub",
            description: github
              ? "Account connected. Select repositories to import."
              : "Bring in pull requests, reviews, and checks.",
            done: !!github,
            href: github ? "/connections" : "/connect/github/setup",
            Icon: Github,
          },
          {
            name: "Connect Jira",
            description: jira
              ? "Account connected. Select projects to import."
              : "Add the plans and issues behind your code.",
            done: !!jira,
            href: jira ? "/connections" : "/connect/jira/setup",
            Icon: Plug,
          },
          {
            name: "Choose your scope",
            description:
              "Select repositories and projects in Connections, then follow your first import.",
            done: imported,
            href: "/connections",
            Icon: RefreshCw,
          },
        ].map((step) => (
          <Link
            className="onboarding-step"
            key={step.name}
            href={step.href}
            prefetch={false}
          >
            <span className={step.done ? "complete" : ""}>
              {step.done ? <Check size={18} /> : <step.Icon size={18} />}
            </span>
            <div>
              <strong>{step.name}</strong>
              <p>{step.description}</p>
            </div>
            <ArrowRight size={15} />
          </Link>
        ))}
      </div>
    </section>
  );
}
