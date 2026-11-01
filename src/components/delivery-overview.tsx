"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCheck,
  Download,
  GitPullRequest,
  Link2,
  Radio,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { EvidenceSignal, PullRequest, WorkspaceData } from "@/lib/types";
import {
  connectionHealth,
  deliveryBrief,
  deliverySummary,
} from "@/lib/delivery";
import { Button } from "./ui";

export function DeliveryOverview({
  data,
  onSignal,
  onPullRequest,
}: {
  data: WorkspaceData;
  onSignal: (signal: EvidenceSignal) => void;
  onPullRequest: (pr: PullRequest) => void;
}) {
  const summary = deliverySummary(data);
  const [tab, setTab] = useState<"attention" | "ready">("attention");
  const prefix = data.mode === "demo" ? "/demo" : "";
  const healthy = data.connections.filter(
    (c) => connectionHealth(c, data.asOf) === "healthy",
  ).length;
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([deliveryBrief(data)], { type: "text/markdown;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `devsync-brief-${data.asOf.slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="delivery-command" aria-label="Delivery focus">
      <div className="delivery-brief">
        <div className="brief-eyebrow">
          <Radio size={14} /> YOUR DELIVERY BRIEF{" "}
          <span>{data.mode === "demo" ? "SAMPLE" : "SNAPSHOT"}</span>
        </div>
        <h2>
          See the work.
          <br />
          <span>Spot what’s next.</span>
        </h2>
        <p>
          {summary.signals.length
            ? `${summary.signals.length} signals to review across your connected work. Start with the ones that need attention.`
            : "A shared view of your code and plans. Connect your tools to surface the work that needs you."}
        </p>
        <div className="brief-actions">
          <Button onClick={download}>
            <Download size={15} /> Export brief
          </Button>
          <Link href={`${prefix}/connections`}>
            <span
              className="health-light"
              data-healthy={healthy > 0 && healthy === data.connections.length}
            />
            {healthy}/{data.connections.length} sources fresh
            <ArrowRight size={13} />
          </Link>
        </div>
        <div className="brief-metrics">
          <div>
            <Link2 size={16} />
            <strong>
              {summary.coverage === null ? "—" : `${summary.coverage}%`}
            </strong>
            <span>Open PRs linked</span>
          </div>
          <div>
            <GitPullRequest size={16} />
            <strong>{summary.review}</strong>
            <span>Awaiting review</span>
          </div>
          <div>
            <CheckCheck size={16} />
            <strong>{summary.ready.length}</strong>
            <span>Approved + passing</span>
          </div>
        </div>
      </div>
      <div className="focus-panel">
        <div className="focus-heading">
          <div>
            <span className="eyebrow">A SMALLER TO-DO LIST</span>
            <h2>Your next move</h2>
          </div>
          <span className="focus-icon">
            <ShieldCheck size={21} />
          </span>
        </div>
        <div
          className="focus-tabs"
          role="group"
          aria-label="Delivery focus filter"
        >
          <button
            aria-pressed={tab === "attention"}
            onClick={() => setTab("attention")}
          >
            Needs attention <span>{summary.signals.length}</span>
          </button>
          <button
            aria-pressed={tab === "ready"}
            onClick={() => setTab("ready")}
          >
            Approved & passing <span>{summary.ready.length}</span>
          </button>
        </div>
        <div className="focus-list">
          {tab === "attention"
            ? summary.signals.slice(0, 3).map((signal) => (
                <button
                  key={signal.id}
                  className="focus-row"
                  onClick={() => onSignal(signal)}
                >
                  <span className={`focus-indicator ${signal.severity}`}>
                    <TriangleAlert size={16} />
                  </span>
                  <span>
                    <strong>{signal.title}</strong>
                    <small>
                      {signal.item?.key || signal.pr?.repository} ·{" "}
                      {signal.pr ? `PR #${signal.pr.number}` : "Work item"}
                    </small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))
            : summary.ready.slice(0, 3).map((pr) => (
                <button
                  key={pr.id}
                  className="focus-row"
                  onClick={() => onPullRequest(pr)}
                >
                  <span className="focus-indicator ready">
                    <CheckCheck size={16} />
                  </span>
                  <span>
                    <strong>{pr.title}</strong>
                    <small>
                      {pr.repository} · #{pr.number}
                    </small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
          {(tab === "attention"
            ? !summary.signals.length
            : !summary.ready.length) && (
            <div className="focus-empty">
              <CheckCheck size={24} />
              <strong>
                {tab === "attention"
                  ? "No current signals"
                  : "Nothing in this view yet"}
              </strong>
              <p>
                {tab === "attention"
                  ? "Signals appear as your sources are imported."
                  : "Open PRs appear here when approved and passing checks."}
              </p>
            </div>
          )}
        </div>
        <div className="focus-footer">
          <span>
            {tab === "attention"
              ? "Source evidence. No automatic changes."
              : "Approval and checks only; mergeability not verified."}
          </span>
          <Link
            href={`${prefix}/${tab === "attention" ? "evidence" : "pull-requests"}`}
          >
            View all <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function SourceHealth({ data }: { data: WorkspaceData }) {
  const affected = data.connections.filter(
    (c) => connectionHealth(c, data.asOf) !== "healthy",
  );
  if (data.mode === "demo" || !affected.length) return null;
  return (
    <div className="source-health" role="status">
      <TriangleAlert size={18} />
      <div>
        <strong>
          {affected.length}{" "}
          {affected.length === 1 ? "source needs" : "sources need"} attention
        </strong>
        <p>
          {affected
            .map(
              (c) =>
                `${c.provider === "github" ? "GitHub" : "Jira"}: ${connectionHealth(c, data.asOf)}`,
            )
            .join(" · ")}
          . Totals may be incomplete until a successful import.
        </p>
      </div>
      <Link href="/connections">
        Review sources <ArrowRight size={14} />
      </Link>
    </div>
  );
}
