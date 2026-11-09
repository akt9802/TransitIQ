import { daysUntil, indiaClockSlot, prettyDate, type ClockSlot } from "@/lib/company/paper-rules";

export type ServiceView = {
  id: string;
  vehicleId: string;
  name: string;
  everyDays: number | null;
  everyKm: number | null;
  nextDueOn: string | null;
  nextDueKm: number | null;
  lastDoneOn: string | null;
  skipTripId: string | null;
};

export function currentKm(odometerKm: number | null, trackedKm: number): number | null {
  if (odometerKm == null) return null;
  return Math.round((odometerKm + trackedKm) * 10) / 10;
}

export function kmLeft(dueKm: number | null, reading: number | null): number | null {
  if (dueKm == null || reading == null) return null;
  return Math.round((dueKm - reading) * 10) / 10;
}

export function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function serviceIsDue(days: number | null, left: number | null): boolean {
  return (days != null && days <= 0) || (left != null && left <= 0);
}

export function dueServices(services: ServiceView[], reading: number | null, today: string): ServiceView[] {
  return services.filter((service) => {
    const days = service.nextDueOn ? daysUntil(service.nextDueOn, today) : null;
    return serviceIsDue(days, kmLeft(service.nextDueKm, reading));
  });
}

export function servicePushSlot(days: number | null, left: number | null, clock: ClockSlot | null): string | null {
  if (serviceIsDue(days, left)) return clock;
  if (days === 30 || days === 15 || days === 7) return `d${days}`;
  if (left != null && left <= 200) return "km200";
  if (left != null && left <= 500) return "km500";
  if (left != null && left <= 1000) return "km1000";
  return null;
}

export function serviceOnce(slot: string): boolean {
  return slot === "km1000" || slot === "km500" || slot === "km200";
}

function urgency(days: number | null, left: number | null): number {
  if (serviceIsDue(days, left)) return -10000 + Math.min(days ?? 0, left ?? 0);
  if (days == null && left == null) return 100000;
  return Math.min(days ?? 99999, left != null ? left / 50 : 99999);
}

export function leadingService(services: ServiceView[], reading: number | null, today: string): ServiceView | null {
  if (services.length === 0) return null;
  return [...services].sort((left, right) => {
    const leftDays = left.nextDueOn ? daysUntil(left.nextDueOn, today) : null;
    const rightDays = right.nextDueOn ? daysUntil(right.nextDueOn, today) : null;
    return urgency(leftDays, kmLeft(left.nextDueKm, reading)) - urgency(rightDays, kmLeft(right.nextDueKm, reading));
  })[0];
}

export function serviceSummary(services: ServiceView[], reading: number | null, today: string): string | null {
  const service = leadingService(services, reading, today);
  if (!service) return null;
  const days = service.nextDueOn ? daysUntil(service.nextDueOn, today) : null;
  const left = kmLeft(service.nextDueKm, reading);
  if (days == null && service.nextDueKm == null) return `${service.name}, no date`;
  if (service.nextDueKm != null && reading == null && days == null) return `${service.name}, kilometres unknown`;
  if (serviceIsDue(days, left)) return `${service.name} due`;
  const parts = [service.name];
  if (days != null) parts.push(days === 0 ? "today" : `${days} days`);
  if (left != null) parts.push(`${Math.max(0, Math.round(left))} km left`);
  return parts.join(" · ");
}

export function serviceNoticeText(registration: string, service: ServiceView, days: number | null, left: number | null): string | null {
  const due = serviceIsDue(days, left);
  const approaching = (days != null && days <= 30) || (left != null && left <= 1000);
  if (!due && !approaching) return null;
  const name = `${registration} ${service.name}`;
  if (due) return `${name} is due. The current trip stays on the road.`;
  if (days != null && left != null) return `${name} is due in ${days} days, or in ${Math.round(left)} km.`;
  if (days != null) return days === 0 ? `${name} is due today.` : `${name} is due in ${days} days.`;
  if (left != null) return `${name} is due in ${Math.round(left)} km.`;
  return null;
}

export function tripServiceNote(
  services: ServiceView[],
  reading: number | null,
  today: string,
  legKm: number[] | null,
  startAt: string | null,
  endAt: string | null
): string | null {
  const service = leadingService(services, reading, today);
  if (!service) return null;
  const days = service.nextDueOn ? daysUntil(service.nextDueOn, today) : null;
  const left = kmLeft(service.nextDueKm, reading);
  if (serviceIsDue(days, left)) return `${service.name} is due. This trip stays on the road.`;
  if (left != null && left > 0 && legKm && legKm.length > 0) {
    const total = legKm.reduce((sum, km) => sum + km, 0);
    if (left <= total) {
      let walked = 0;
      let leg = 1;
      for (const km of legKm) {
        walked += km;
        if (walked >= left) break;
        leg += 1;
      }
      const place = legKm.length === 1 ? "on this trip" : `on leg ${leg}`;
      return `${service.name} is due in ${Math.round(left)} km, ${place}.`;
    }
  }
  if (days != null && days > 0 && service.nextDueOn && startAt && endAt) {
    const start = indiaDay(startAt);
    const end = indiaDay(endAt);
    if (service.nextDueOn >= start && service.nextDueOn <= end) {
      return `${service.name} is due on ${prettyDate(service.nextDueOn)}, during this trip.`;
    }
  }
  return null;
}

function indiaDay(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

export { daysUntil, indiaClockSlot };
