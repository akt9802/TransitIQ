export const ISSUE_KINDS = ["pothole", "water", "accident", "other"] as const;

export type IssueKind = (typeof ISSUE_KINDS)[number];

export const ISSUE_LABEL: Record<IssueKind, string> = {
  pothole: "Pothole",
  water: "Water logging",
  accident: "Accident",
  other: "Other",
};

export const ACCIDENT_MS = 3 * 24 * 60 * 60 * 1000;

export function issueKind(value: unknown): IssueKind | null {
  return typeof value === "string" && ISSUE_KINDS.includes(value as IssueKind) ? (value as IssueKind) : null;
}

export function accidentExpired(reportedAt: Date, now = Date.now()) {
  return now - reportedAt.getTime() >= ACCIDENT_MS;
}

export function warnLine(kind: IssueKind, meters: number) {
  const name = ISSUE_LABEL[kind] === "Other" ? "Road problem" : ISSUE_LABEL[kind];
  return meters < 100 ? `${name} here. Slow down.` : `${name} in ${Math.round(meters)} m. Slow down.`;
}
