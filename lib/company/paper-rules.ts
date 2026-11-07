export const REQUIRED_VEHICLE_EXPIRY = ["insurance", "permit", "fitness", "pollution"] as const;

const LABELS: Record<string, string> = {
  rc: "RC",
  insurance: "Insurance",
  permit: "Permit",
  fitness: "Fitness",
  pollution: "Pollution",
  road_tax: "Road tax",
  license: "Licence",
  other: "Other paper",
};

export type ClockSlot = "morning" | "afternoon" | "evening";

export function paperLabel(kind: string): string {
  return LABELS[kind] ?? kind;
}

export function indiaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function indiaClockSlot(now = new Date()): ClockSlot | null {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now)
  );
  if (hour >= 8 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return null;
}

export function daysUntil(expiresOn: string, today: string): number {
  const [year, month, day] = expiresOn.slice(0, 10).split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const expiry = Date.UTC(year, month - 1, day);
  const current = Date.UTC(todayYear, todayMonth - 1, todayDay);
  return Math.round((expiry - current) / 86400000);
}

/** One notice on day 30, 15, and 7. From day 6 through overdue, one notice per daytime slot. */
export function pushSlot(days: number, clock: ClockSlot | null): string | null {
  if (days === 30 || days === 15 || days === 7) return `d${days}`;
  if (days <= 6 && clock) return clock;
  return null;
}

export function prettyDate(ymd: string): string {
  const [year, month, day] = ymd.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function expiryPhrase(days: number, expiresOn: string): string {
  if (days > 1) return `expires in ${days} days, on ${prettyDate(expiresOn)}`;
  if (days === 1) return `expires tomorrow, on ${prettyDate(expiresOn)}`;
  if (days === 0) return "expires today";
  if (days === -1) return "expired yesterday";
  return `expired ${Math.abs(days)} days ago`;
}

export type PaperSnapshot = {
  kind: string;
  documentNumber: string | null;
  expiresOn: string | null;
};

export function vehiclePaperLine(rows: PaperSnapshot[], today: string): string {
  let overdue: { kind: string; days: number } | null = null;
  let soon: { kind: string; days: number } | null = null;
  const byKind = new Map<string, PaperSnapshot[]>();
  for (const row of rows) {
    const list = byKind.get(row.kind) ?? [];
    list.push(row);
    byKind.set(row.kind, list);
    if (!row.expiresOn) continue;
    const days = daysUntil(row.expiresOn, today);
    if (days < 0 && (!overdue || days < overdue.days)) overdue = { kind: row.kind, days };
    if (days >= 0 && (!soon || days < soon.days)) soon = { kind: row.kind, days };
  }
  if (overdue) return `${paperLabel(overdue.kind)} expired`;
  for (const kind of REQUIRED_VEHICLE_EXPIRY) {
    const dated = (byKind.get(kind) ?? []).some((row) => row.expiresOn);
    if (!dated) return `${paperLabel(kind)} not added`;
  }
  const rcNumber = (byKind.get("rc") ?? []).some((row) => row.documentNumber?.trim());
  if (!rcNumber) return "RC not added";
  if (soon) return soon.days === 0 ? `${paperLabel(soon.kind)} expires today` : `${paperLabel(soon.kind)} in ${soon.days} days`;
  return "In date";
}
