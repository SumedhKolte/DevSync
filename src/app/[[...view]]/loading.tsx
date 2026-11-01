import { GitBranch } from "lucide-react";
export default function Loading() {
  return (
    <main
      className="workspace-loading"
      aria-busy="true"
      aria-label="Loading workspace"
    >
      <div className="loading-brand">
        <GitBranch size={24} />
        <strong>devsync.</strong>
      </div>
      <p role="status">Bringing your workspace together…</p>
      <div className="skeleton-heading" />
      <div className="skeleton-brief" />
      <div className="skeleton-grid">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} />
        ))}
      </div>
      <div className="skeleton-table" />
    </main>
  );
}
