import { metersBetween } from "@/lib/company/geo";

/** Metres between two checks before the truck counts as moving. */
export const MOVE_METERS = 400;
/** Driving time, while the truck is moving, before the driver is told to rest. */
export const DRIVE_LIMIT_HOURS = 12;
const MOVE_GAP_MIN_MS = 30 * 1000;
const MOVE_GAP_MAX_MS = 12 * 60 * 1000;
const MAX_SPEED_KMH = 150;

export type MotionPoint = {
  tripId: string | null;
  latitude: number;
  longitude: number;
  at: number;
};

export type SleepSpan = {
  start: number;
  end: number | null;
};

export type MotionSummary = {
  movingHours: number;
  moveCount: number;
  drivingHours: number;
  restDue: boolean;
  sleeping: boolean;
  dutyKey: string;
  liveMoveCount: number;
  liveMovingHours: number;
  liveSpeedKmh: number | null;
  liveMoving: boolean;
};

type Segment = {
  moving: boolean;
  creditMs: number;
  speedKmh: number | null;
  countMove: boolean;
};

export function formatDrive(hours: number): string {
  const total = Math.max(0, Math.round(hours * 60));
  const whole = Math.floor(total / 60);
  const minutes = total % 60;
  if (whole === 0) return `${minutes} min`;
  if (minutes === 0) return `${whole} h`;
  return `${whole} h ${minutes} min`;
}

export function restMessage(hours: number): string {
  return `You have been driving for ${formatDrive(hours)}. Please stop and take a rest.`;
}

export function segmentMove(previous: MotionPoint, next: MotionPoint): Segment {
  const gapMs = next.at - previous.at;
  if (gapMs < MOVE_GAP_MIN_MS || previous.tripId !== next.tripId) {
    return { moving: false, creditMs: 0, speedKmh: null, countMove: false };
  }
  const meters = metersBetween(
    { lat: previous.latitude, lng: previous.longitude },
    { lat: next.latitude, lng: next.longitude }
  );
  const speedKmh = (meters / 1000) / (gapMs / 3600000);
  if (speedKmh > MAX_SPEED_KMH) {
    return { moving: false, creditMs: 0, speedKmh: null, countMove: false };
  }
  const speed = Math.round(speedKmh * 10) / 10;
  if (meters < MOVE_METERS) {
    return { moving: false, creditMs: 0, speedKmh: gapMs <= MOVE_GAP_MAX_MS ? speed : null, countMove: false };
  }
  if (gapMs > MOVE_GAP_MAX_MS) {
    return { moving: false, creditMs: 0, speedKmh: null, countMove: true };
  }
  return { moving: true, creditMs: gapMs, speedKmh: speed, countMove: true };
}

function hours(ms: number) {
  return Math.round((ms / 3600000) * 10) / 10;
}

function dutyWindow(sleeps: SleepSpan[], now: number) {
  let lastWake = 0;
  let sleepFrom: number | null = null;
  for (const sleep of sleeps) {
    const open = sleep.end == null || sleep.end > now;
    if (open) {
      sleepFrom = sleepFrom == null ? sleep.start : Math.min(sleepFrom, sleep.start);
      continue;
    }
    if (sleep.end != null && sleep.end <= now && sleep.end > lastWake) lastWake = sleep.end;
  }
  return { lastWake, sleepFrom, sleeping: sleepFrom != null && sleepFrom <= now };
}

function driveCredit(from: number, to: number, lastWake: number, sleepFrom: number | null) {
  const start = Math.max(from, lastWake);
  const end = sleepFrom == null ? to : Math.min(to, sleepFrom);
  if (end <= start) return 0;
  return end - start;
}

export function summarizeMotion(
  points: MotionPoint[],
  sleeps: SleepSpan[],
  now: number,
  liveTripId: string | null
): MotionSummary {
  const duty = dutyWindow(sleeps, now);
  let movingMs = 0;
  let drivingMs = 0;
  let moveCount = 0;
  let liveMoveCount = 0;
  let liveMovingMs = 0;
  let wasMoving = false;
  let stoppedSamples = 0;
  const movesOnTrip = new Map<string, number>();
  let liveSpeedKmh: number | null = null;
  let liveMoving = false;

  const ordered = [...points].sort((left, right) => left.at - right.at);
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const next = ordered[index];
    if (previous.tripId !== next.tripId) {
      wasMoving = false;
      stoppedSamples = 0;
      continue;
    }
    const segment = segmentMove(previous, next);
    const tripKey = next.tripId ?? "";
    const onLive = liveTripId != null && next.tripId === liveTripId;
    if (segment.moving || segment.countMove) {
      const soFar = movesOnTrip.get(tripKey) ?? 0;
      if (!wasMoving && (soFar === 0 || stoppedSamples >= 2)) {
        moveCount += 1;
        movesOnTrip.set(tripKey, soFar + 1);
        if (onLive) liveMoveCount += 1;
      }
      wasMoving = true;
      stoppedSamples = 0;
      if (segment.moving) {
        movingMs += segment.creditMs;
        drivingMs += driveCredit(previous.at, next.at, duty.lastWake, duty.sleepFrom);
        if (onLive) liveMovingMs += segment.creditMs;
      }
    } else {
      stoppedSamples += 1;
      if (stoppedSamples >= 2) wasMoving = false;
    }
    if (onLive) {
      liveSpeedKmh = segment.speedKmh;
      liveMoving = segment.moving;
    }
  }

  const drivingHours = hours(drivingMs);
  const resting = duty.sleeping;
  return {
    movingHours: hours(movingMs),
    moveCount,
    drivingHours,
    restDue: !resting && hours(drivingMs) >= DRIVE_LIMIT_HOURS,
    sleeping: resting,
    dutyKey: resting ? `sleep:${duty.sleepFrom}` : `wake:${duty.lastWake}`,
    liveMoveCount,
    liveMovingHours: hours(liveMovingMs),
    liveSpeedKmh,
    liveMoving,
  };
}
