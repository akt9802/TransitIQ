export type ServiceInput = {
  vehicleId: string;
  name: string;
  everyDays: number | null;
  everyKm: number | null;
  nextDueOn: string | null;
  nextDueKm: number | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseService(body: unknown): ServiceInput {
  const raw = asObject(body);
  const name = limited(raw.name, 40, "Service name");
  if (!name || name.length < 2) throw new Error("Service name is required");
  const vehicleId = text(raw.vehicleId);
  if (!UUID.test(vehicleId)) throw new Error("Truck is required");
  return {
    vehicleId,
    name,
    everyDays: optionalInt(raw.everyDays, "Repeat days", 1, 3650),
    everyKm: repeatKm(raw.everyKm),
    nextDueOn: optionalDate(raw.nextDueOn, "Due date"),
    nextDueKm: optionalNumber(raw.nextDueKm, "Due kilometres", 10000000),
  };
}

export function parseServiceDone(body: unknown): { doneOn: string | null; odometerKm: number | null } {
  const raw = asObject(body);
  return {
    doneOn: optionalDate(raw.doneOn, "Done date"),
    odometerKm: optionalNumber(raw.odometerKm, "Odometer", 10000000),
  };
}

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") throw new Error("Missing details");
  return body as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function limited(value: unknown, max: number, label: string): string | null {
  const trimmed = text(value);
  if (!trimmed) return null;
  if (trimmed.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
  return trimmed;
}

function optionalNumber(value: unknown, label: string, max: number): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(text(value));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) {
    throw new Error(`${label} must be between 0 and ${max}`);
  }
  return parsed;
}

function optionalInt(value: unknown, label: string, min: number, max: number): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(text(value));
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}`);
  }
  return parsed;
}

function optionalDate(value: unknown, label: string): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
    throw new Error(`${label} must be a real date`);
  }
  return raw;
}

function repeatKm(value: unknown): number | null {
  const parsed = optionalNumber(value, "Repeat kilometres", 10000000);
  if (parsed === 0) throw new Error("Repeat kilometres must be at least 1");
  return parsed;
}
