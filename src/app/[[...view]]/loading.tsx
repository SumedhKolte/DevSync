// Shown only on a first load or full page load; switching views inside the
// dashboard happens in place. Mirrors the real layout to avoid a jump.
const Bar = ({ className }: { className: string }) => (
  <span className={`skeleton ${className}`} />
);
export default function Loading() {
  return (
    <div
      className="shell-skeleton"
      aria-busy="true"
      aria-label="Loading workspace"
    >
      <aside className="shell-skeleton-sidebar" aria-hidden="true">
        <Bar className="sk-brand" />
        <Bar className="sk-workspace" />
        <Bar className="sk-search" />
        {Array.from({ length: 8 }, (_, i) => (
          <Bar key={i} className="sk-nav" />
        ))}
        <span className="sk-spacer" />
        <Bar className="sk-nav" />
        <Bar className="sk-profile" />
      </aside>
      <div className="shell-skeleton-main">
        <div className="shell-skeleton-topbar" aria-hidden="true">
          <Bar className="sk-crumb" />
          <Bar className="sk-avatar" />
        </div>
        <main className="shell-skeleton-content">
          <p className="sk-status" role="status">
            Loading your workspace…
          </p>
          <div aria-hidden="true">
            <Bar className="sk-eyebrow" />
            <Bar className="sk-title" />
            <Bar className="sk-subtitle" />
            <div className="sk-brief">
              <Bar className="sk-brief-main" />
              <Bar className="sk-brief-side" />
            </div>
            <div className="sk-stats">
              {Array.from({ length: 4 }, (_, i) => (
                <Bar key={i} className="sk-stat" />
              ))}
            </div>
            <div className="sk-table">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="sk-row">
                  <Bar className="sk-cell-title" />
                  <Bar className="sk-cell" />
                  <Bar className="sk-cell" />
                  <Bar className="sk-dot" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
