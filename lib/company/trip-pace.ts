import { metersBetween } from "@/lib/company/geo";

export const ROAD_MATCH_METERS = 50_000;
const LONG_REACH_METERS = 150_000;
const MAX_RUN_MS = 21 * 24 * 60 * 60 * 1000;
const MAX_TRUCK_MPS = 110 / 3.6;
const LATE_CLOSE_MS = 12 * 60 * 60 * 1000;

export type PaceStop = {
  latitude: number | null;
  longitude: number | null;
  address?: string | null;
  arrivedAt?: string | null;
  sequence?: number;
};

export type PaceTrip = {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  stops: PaceStop[];
};

export type RoadPace = {
  runs: number;
  lastMinutes: number;
  shortestMinutes: number;
  longestMinutes: number;
  from: string;
  to: string;
};

type Point = { lat: number; lng: number };

function ordered(stops: PaceStop[]) {
  return stops.slice().sort((left, right) => (left.sequence ?? 0) - (right.sequence ?? 0));
}

function pointsOf(stops: PaceStop[]): Point[] {
  return ordered(stops).flatMap((stop) =>
    stop.latitude == null || stop.longitude == null ? [] : [{ lat: stop.latitude, lng: stop.longitude }]
  );
}

function reachOf(points: Point[]) {
  if (points.length === 0) return 0;
  const start = points[0];
  return points.reduce((furthest, point) => Math.max(furthest, metersBetween(start, point)), 0);
}

export function sameRoad(nextStops: PaceStop[], pastStops: PaceStop[]) {
  const next = pointsOf(nextStops);
  const past = pointsOf(pastStops);
  if (next.length < 2 || past.length < 2) return false;
  if (metersBetween(next[0], past[0]) > ROAD_MATCH_METERS) return false;
  if (metersBetween(next[next.length - 1], past[past.length - 1]) > ROAD_MATCH_METERS) return false;
  const nextReach = reachOf(next);
  const pastReach = reachOf(past);
  const big = Math.max(nextReach, pastReach);
  const small = Math.min(nextReach, pastReach);
  if (big < LONG_REACH_METERS) return true;
  return small >= big * 0.6;
}

export function runMinutes(trip: PaceTrip): number | null {
  if (trip.status !== "completed" && trip.status !== "closed") return null;
  if (!trip.startedAt || !trip.completedAt) return null;
  const started = Date.parse(trip.startedAt);
  const completed = Date.parse(trip.completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed <= started) return null;
  const stops = ordered(trip.stops);
  const points = pointsOf(stops);
  if (points.length < 2) return null;
  const arrivedRaw = stops[stops.length - 1]?.arrivedAt;
  const arrived = arrivedRaw ? Date.parse(arrivedRaw) : Number.NaN;
  let finish = completed;
  if (Number.isFinite(arrived) && arrived > started && arrived <= completed + 60 * 60 * 1000 && completed - arrived > LATE_CLOSE_MS) {
    finish = arrived;
  }
  const duration = finish - started;
  const straight = metersBetween(points[0], points[points.length - 1]);
  if (duration <= 0 || duration > MAX_RUN_MS) return null;
  if (duration < (straight / MAX_TRUCK_MPS) * 1000) return null;
  return Math.round(duration / 60_000);
}

export function roadPace(past: PaceTrip[], next: { id?: string | null; stops: PaceStop[] }): RoadPace | null {
  const nextPoints = pointsOf(next.stops);
  if (nextPoints.length < 2) return null;
  const runs = past
    .filter((trip) => trip.id !== next.id)
    .map((trip) => ({ trip, minutes: sameRoad(next.stops, trip.stops) ? runMinutes(trip) : null }))
    .filter((item): item is { trip: PaceTrip; minutes: number } => item.minutes != null)
    .sort((left, right) => Date.parse(right.trip.completedAt ?? "") - Date.parse(left.trip.completedAt ?? ""))
    .slice(0, 8);
  if (runs.length === 0) return null;
  const last = runs[0];
  const lastStops = ordered(last.trip.stops);
  const minutes = runs.map((item) => item.minutes);
  return {
    runs: runs.length,
    lastMinutes: last.minutes,
    shortestMinutes: Math.min(...minutes),
    longestMinutes: Math.max(...minutes),
    from: shortPlace(lastStops[0]?.address),
    to: shortPlace(lastStops[lastStops.length - 1]?.address),
  };
}

function shortPlace(address?: string | null) {
  const parts = address?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
  return parts.slice(0, 2).join(", ");
}

export function formatRun(ms: number): string {
  const hours = Math.max(0, Math.round(ms / 3_600_000));
  if (hours < 1) return "under an hour";
  if (hours < 36) return hours === 1 ? "1 hour" : `${hours} hours`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const dayLabel = days === 1 ? "1 day" : `${days} days`;
  if (rest < 3) return dayLabel;
  const hourLabel = rest === 1 ? "1 hour" : `${rest} hours`;
  return `${dayLabel} ${hourLabel}`;
}

function minutesBetween(start: string, end: string): number | null {
  if (!start || !end) return null;
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  return Math.round((to - from) / 60_000);
}

export function paceCopy(
  pace: RoadPace,
  plan: { start: string; end: string; deadline: string }
): { summary: string; warning: string | null } {
  const last = formatRun(pace.lastMinutes * 60_000);
  const named = pace.from.length > 0 && pace.to.length > 0;
  const where = named ? ` from ${pace.from} to ${pace.to}` : " between these places";
  let summary = `The last finished trip${where} took ${last}. That includes waiting, food, and rest.`;
  if (pace.runs > 1 && pace.shortestMinutes !== pace.longestMinutes) {
    summary += ` Past trips took ${formatRun(pace.shortestMinutes * 60_000)} to ${formatRun(pace.longestMinutes * 60_000)}.`;
  }
  const planned = minutesBetween(plan.start, plan.end);
  const promised = minutesBetween(plan.start, plan.deadline);
  const short = (value: number | null) => value != null && value < pace.lastMinutes * 0.9;
  let warning: string | null = null;
  if (short(planned) && planned != null) {
    warning = `This plan is ${formatRun(planned * 60_000)}. The last trip took ${last}.`;
  }
  if (promised != null && short(promised) && (planned == null || promised + 30 < planned)) {
    const line = `The deadline is ${formatRun(promised * 60_000)} from the start. The last trip took ${last}.`;
    warning = warning ? `${warning} ${line}` : line;
  }
  return { summary, warning };
}
