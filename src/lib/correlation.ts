// Candidate extraction is intentionally separate from authorization and validation.
// Every candidate must be resolved against the selected Jira site's actual issues.
export function extractIssueKeys(
  ...sources: (string | null | undefined)[]
): string[] {
  const found = new Set<string>();
  for (const source of sources) {
    for (const match of (source ?? "").matchAll(
      /(?<![A-Za-z0-9])([A-Z][A-Z0-9_]*-\d+)(?![A-Za-z0-9])/g,
    ))
      found.add(match[1]);
  }
  return [...found];
}
export function classifyLinks(candidates: string[], validKeys: Set<string>) {
  const confirmed = candidates.filter((key) => validKeys.has(key));
  const unresolved = candidates.filter((key) => !validKeys.has(key));
  return {
    confirmed,
    unresolved,
    state: unresolved.length
      ? "ambiguous"
      : confirmed.length
        ? "linked"
        : "unlinked",
  } as const;
}
