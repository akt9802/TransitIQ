import type {
  AssignableRole,
  CompanyInput,
  DeviceInput,
  DriverInput,
  Language,
  NotificationPreference,
  PaperInput,
  PersonInput,
  TripInput,
  VehicleInput,
} from "@/lib/company/types";
import {
  ALERT_CHANNELS,
  ALERT_KINDS,
  ASSIGNABLE_ROLES,
  ATTENDANCE_KINDS,
  DEVICE_KINDS,
  DRIVER_DOC_KINDS,
  DRIVER_STATUSES,
  HOS_KINDS,
  PAY_TYPES,
  TRIP_STATUSES,
  TRIP_STOP_KINDS,
  TRUCK_TYPES,
  VEHICLE_DOC_KINDS,
  VEHICLE_OWNERSHIP,
  VEHICLE_STATUSES,
} from "@/lib/company/types";

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function limited(value: unknown, max: number, label: string): string | null {
  const trimmed = text(value);
  if (!trimmed) return null;
  if (trimmed.length > max) {
    throw new Error(`${label} must be ${max} characters or fewer`);
  }
  return trimmed;
}

function emailAddress(value: unknown): string {
  const trimmed = limited(value, 200, "Customer email");
  if (!trimmed) throw new Error("Customer email is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw new Error("Customer email is not valid");
  return trimmed.toLowerCase();
}

function phone(value: unknown, label: string): string | null {
  const trimmed = limited(value, 20, label);
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw new Error(`${label} should include 8 to 15 digits`);
  }
  return trimmed;
}

export function parseCompanyInput(body: unknown): CompanyInput {
  if (!body || typeof body !== "object") {
    throw new Error("Missing details");
  }
  const raw = body as Record<string, unknown>;

  const fullName = limited(raw.fullName, 120, "Your name");
  if (!fullName) throw new Error("Your name is required");

  const companyName = limited(raw.companyName, 120, "Fleet name");
  if (!companyName) throw new Error("Fleet name is required");

  const language: Language = raw.language === "hi" ? "hi" : "en";
  if (raw.language !== undefined && raw.language !== "en" && raw.language !== "hi") {
    throw new Error("Language must be English or Hindi");
  }

  const gstinRaw = limited(raw.gstin, 15, "GSTIN");
  const gstin = gstinRaw ? gstinRaw.toUpperCase() : null;
  if (gstin && !GSTIN.test(gstin)) {
    throw new Error("GSTIN should look like 22AAAAA0000A1Z5");
  }

  const companyEmail = limited(raw.companyEmail, 200, "Company email");
  if (companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)) {
    throw new Error("Company email is not valid");
  }

  return {
    fullName,
    phone: phone(raw.phone, "Your phone"),
    address: limited(raw.address, 500, "Your address"),
    language,
    companyName,
    legalName: limited(raw.legalName, 200, "Legal name"),
    gstin,
    companyPhone: phone(raw.companyPhone, "Company phone"),
    companyEmail: companyEmail ? companyEmail.toLowerCase() : null,
    companyAddress: limited(raw.companyAddress, 500, "Company address"),
  };
}

function asObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") throw new Error("Missing details");
  return body as Record<string, unknown>;
}

export function parsePersonInput(body: unknown): PersonInput {
  const raw = asObject(body);
  const fullName = limited(raw.fullName, 120, "Name");
  if (!fullName) throw new Error("Name is required");
  const email = limited(raw.email, 200, "Email");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email is required");
  }
  const roleKey = text(raw.roleKey);
  if (!ASSIGNABLE_ROLES.some((role) => role.key === roleKey)) {
    throw new Error("Choose a role for this person");
  }
  return {
    fullName,
    email: email.toLowerCase(),
    phone: phone(raw.phone, "Phone"),
    roleKey: roleKey as AssignableRole,
    branchId: optionalUuid(raw.branchId, "Branch"),
  };
}

function choice(value: unknown, allowed: readonly { key: string }[], label: string, fallback?: string): string {
  const picked = text(value) || fallback || "";
  if (!allowed.some((item) => item.key === picked)) {
    throw new Error(`${label} is not valid`);
  }
  return picked;
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

export function parseVehicleInput(body: unknown): VehicleInput {
  const raw = asObject(body);
  const registration = limited(raw.registrationNumber, 20, "Registration number");
  if (!registration) throw new Error("Registration number is required");
  const year = optionalInt(raw.year, "Year", 1980, 2030);
  const contractStart = optionalDate(raw.contractStart, "Contract start");
  const contractEnd = optionalDate(raw.contractEnd, "Contract end");
  if (contractStart && contractEnd && contractEnd < contractStart) {
    throw new Error("Contract end must be on or after the start");
  }
  const ownership = choice(raw.ownership, VEHICLE_OWNERSHIP, "Ownership", "owned");
  const vendorId = ownership === "attached" ? optionalUuid(raw.vendorId, "Vendor") : null;
  return {
    registrationNumber: registration.toUpperCase().replace(/\s+/g, ""),
    make: limited(raw.make, 80, "Make"),
    model: limited(raw.model, 80, "Model"),
    year,
    chassisNumber: limited(raw.chassisNumber, 40, "Chassis number"),
    engineNumber: limited(raw.engineNumber, 40, "Engine number"),
    truckType: choice(raw.truckType, TRUCK_TYPES, "Truck type"),
    loadCapacityKg: optionalNumber(raw.loadCapacityKg, "Load capacity", 200000),
    axleCount: optionalInt(raw.axleCount, "Axle count", 1, 20),
    lengthM: optionalNumber(raw.lengthM, "Length", 30),
    widthM: optionalNumber(raw.widthM, "Width", 5),
    heightM: optionalNumber(raw.heightM, "Height", 6),
    ownership,
    contractStart,
    contractEnd,
    status: choice(raw.status, VEHICLE_STATUSES, "Status", "active"),
    odometerKm: optionalNumber(raw.odometerKm, "Odometer", 10000000),
    tankCapacityL: optionalNumber(raw.tankCapacityL, "Tank capacity", 2000),
    branchId: optionalUuid(raw.branchId, "Branch"),
    vendorId,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalUuid(value: unknown, label: string): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (!UUID.test(raw)) throw new Error(`${label} is not valid`);
  return raw;
}

function requiredUuid(value: unknown, label: string): string {
  const id = optionalUuid(value, label);
  if (!id) throw new Error(`${label} is required`);
  return id;
}

export function parseBranch(body: unknown): { name: string; address: string | null } {
  const raw = asObject(body);
  const name = limited(raw.name, 120, "Branch name");
  if (!name) throw new Error("Branch name is required");
  return { name, address: limited(raw.address, 500, "Address") };
}

export function parseVendor(body: unknown): { name: string; phone: string | null; gstin: string | null } {
  const raw = asObject(body);
  const name = limited(raw.name, 120, "Vendor name");
  if (!name) throw new Error("Vendor name is required");
  const gstinRaw = limited(raw.gstin, 15, "GSTIN");
  const gstin = gstinRaw ? gstinRaw.toUpperCase() : null;
  if (gstin && !GSTIN.test(gstin)) throw new Error("GSTIN should look like 22AAAAA0000A1Z5");
  return { name, phone: phone(raw.phone, "Phone"), gstin };
}

export function parseDriverInput(body: unknown): DriverInput {
  const raw = asObject(body);
  const fullName = limited(raw.fullName, 120, "Name");
  if (!fullName) throw new Error("Name is required");
  const driverPhone = phone(raw.phone, "Phone");
  if (!driverPhone) throw new Error("Phone is required");
  const payRate = optionalNumber(raw.payRate, "Pay rate", 10000000);
  return {
    fullName,
    phone: driverPhone,
    address: limited(raw.address, 500, "Address"),
    branchId: optionalUuid(raw.branchId, "Branch"),
    emergencyName: limited(raw.emergencyName, 120, "Emergency contact"),
    emergencyPhone: phone(raw.emergencyPhone, "Emergency phone"),
    licenseNumber: requiredLicense(raw.licenseNumber),
    licenseClass: limited(raw.licenseClass, 40, "License class"),
    licenseExpiresOn: requiredLicenseExpiry(raw.licenseExpiresOn),
    licenseEndorsements: limited(raw.licenseEndorsements, 200, "Endorsements"),
    payType: choice(raw.payType, PAY_TYPES, "Pay type", "per_trip"),
    payRate,
    status: choice(raw.status, DRIVER_STATUSES, "Status", "active"),
    userId: optionalUuid(raw.userId, "Sign-in"),
  };
}

function requiredLicense(value: unknown): string {
  const number = limited(value, 40, "License number");
  if (!number) throw new Error("License number is required");
  return number;
}

function requiredLicenseExpiry(value: unknown): string {
  const expiry = optionalDate(value, "License expiry");
  if (!expiry) throw new Error("License expiry is required");
  return expiry;
}

export function parseVehiclePapers(body: unknown): { kind: string; documentNumber: string | null; expiresOn: string | null }[] {
  const raw = asObject(body);
  if (raw.papers == null) return [];
  if (!Array.isArray(raw.papers)) throw new Error("Papers are not valid");
  const seen = new Set<string>();
  return raw.papers.map((item) => {
    const row = asObject(item);
    const kind = choice(row.kind, VEHICLE_DOC_KINDS, "Paper");
    if (seen.has(kind)) throw new Error("Choose each paper once");
    seen.add(kind);
    return {
      kind,
      documentNumber: limited(row.documentNumber, 40, "Document number"),
      expiresOn: optionalDate(row.expiresOn, "Expires on"),
    };
  });
}

export function parsePaperUpdate(body: unknown): { documentNumber: string | null; expiresOn: string | null } {
  const raw = asObject(body);
  return {
    documentNumber: limited(raw.documentNumber, 40, "Document number"),
    expiresOn: optionalDate(raw.expiresOn, "Expires on"),
  };
}

export function parseVehiclePaper(body: unknown): PaperInput {
  return parsePaper(body, VEHICLE_DOC_KINDS, "Vehicle", true);
}

export function parseDriverPaper(body: unknown): PaperInput {
  return parsePaper(body, DRIVER_DOC_KINDS, "Driver", false);
}

function parsePaper(
  body: unknown,
  kinds: readonly { key: string }[],
  parentLabel: string,
  withIssued: boolean
): PaperInput {
  const raw = asObject(body);
  return {
    parentId: requiredUuid(raw.parentId, parentLabel),
    kind: choice(raw.kind, kinds, "Paper"),
    documentNumber: limited(raw.documentNumber, 40, "Document number"),
    fileKey: limited(raw.fileKey, 300, "File reference"),
    issuedOn: withIssued ? optionalDate(raw.issuedOn, "Issued on") : null,
    expiresOn: optionalDate(raw.expiresOn, "Expires on"),
  };
}

export function parseDeviceInput(body: unknown): DeviceInput {
  const raw = asObject(body);
  const externalId = limited(raw.externalId, 120, "Tracker id");
  if (!externalId) throw new Error("Tracker id is required");
  return {
    kind: choice(raw.kind, DEVICE_KINDS, "Tracker type"),
    externalId,
    vehicleId: optionalUuid(raw.vehicleId, "Vehicle"),
    driverId: optionalUuid(raw.driverId, "Driver"),
  };
}

export function parseShift(body: unknown): { driverId: string; vehicleId: string | null; startsAt: string; endsAt: string } {
  const raw = asObject(body);
  const startsAt = requiredInstant(raw.startsAt, "Start");
  const endsAt = requiredInstant(raw.endsAt, "End");
  if (endsAt <= startsAt) throw new Error("End must be after the start");
  return {
    driverId: requiredUuid(raw.driverId, "Driver"),
    vehicleId: optionalUuid(raw.vehicleId, "Vehicle"),
    startsAt,
    endsAt,
  };
}

export function parseAttendance(body: unknown): { driverId: string; day: string; kind: string; note: string | null } {
  const raw = asObject(body);
  const day = optionalDate(raw.day, "Day");
  if (!day) throw new Error("Day is required");
  return {
    driverId: requiredUuid(raw.driverId, "Driver"),
    day,
    kind: choice(raw.kind, ATTENDANCE_KINDS, "Attendance"),
    note: limited(raw.note, 300, "Note"),
  };
}

export function parseHos(body: unknown): { driverId: string; kind: string; startedAt: string; endedAt: string | null } {
  const raw = asObject(body);
  const startedAt = requiredInstant(raw.startedAt, "Start");
  const endedAt = raw.endedAt ? requiredInstant(raw.endedAt, "End") : null;
  if (endedAt && endedAt <= startedAt) throw new Error("End must be after the start");
  return {
    driverId: requiredUuid(raw.driverId, "Driver"),
    kind: choice(raw.kind, HOS_KINDS, "Hours"),
    startedAt,
    endedAt,
  };
}

export function parsePoints(body: unknown): { driverId: string; points: number; reason: string; sourceType: string | null } {
  const raw = asObject(body);
  const points = optionalInt(raw.points, "Points", -500, 500);
  if (points == null) throw new Error("Points are required");
  const reason = limited(raw.reason, 200, "Reason");
  if (!reason) throw new Error("Reason is required");
  const source = text(raw.sourceType);
  if (source && source !== "incident_report" && source !== "trip") {
    throw new Error("Source is not valid");
  }
  return {
    driverId: requiredUuid(raw.driverId, "Driver"),
    points,
    reason,
    sourceType: source || null,
  };
}

export function parseTripInput(body: unknown): TripInput {
  const raw = asObject(body);
  const customerId = optionalUuid(raw.customerId, "Customer");
  const customerName = limited(raw.customerName, 120, "Customer name");
  if (!customerId && !customerName) throw new Error("Customer name is required");
  const stopRows = Array.isArray(raw.stops) ? raw.stops : [];
  if (stopRows.length < 2) throw new Error("A start and an end are required");
  if (stopRows.length > 8) throw new Error("A trip can have at most 8 stops");
  const stops = stopRows.map((item, index) => {
    const stop = asObject(item);
    const kind = choice(stop.kind, TRIP_STOP_KINDS, "Stop");
    const label = index === 0 ? "start" : index === stopRows.length - 1 ? "end" : `stop ${index + 1}`;
    const address = limited(stop.address, 400, index === 0 ? "Start address" : index === stopRows.length - 1 ? "End address" : "Stop address");
    if (!address) throw new Error(`Choose the ${label} on the map`);
    const latitude = coordinate(stop.latitude, "Latitude", -90, 90);
    const longitude = coordinate(stop.longitude, "Longitude", -180, 180);
    if (latitude == null || longitude == null) throw new Error(`Choose the ${label} on the map`);
    const scheduledAt = text(stop.scheduledAt) ? requiredInstant(stop.scheduledAt, "Stop time") : null;
    return { kind, address, latitude, longitude, scheduledAt };
  });
  if (stops[0].kind !== "pickup") throw new Error("The first stop must be a pickup");
  const last = stops[stops.length - 1];
  if (last.kind === "pickup") throw new Error("The last stop must be a drop");
  const startAt = stops[0].scheduledAt;
  const endAt = last.scheduledAt;
  if (!startAt) throw new Error("Start time is required");
  if (!endAt) throw new Error("End time is required");
  if (endAt < startAt) throw new Error("End time must be on or after the start");
  for (const stop of stops.slice(1, -1)) {
    if (stop.scheduledAt && startAt && stop.scheduledAt < startAt) {
      throw new Error("A stop cannot be before the start");
    }
    if (stop.scheduledAt && endAt && stop.scheduledAt > endAt) {
      throw new Error("A stop cannot be after the end");
    }
  }
  return {
    customerId,
    customerName,
    customerPhone: phone(raw.customerPhone, "Customer phone"),
    customerEmail: emailAddress(raw.customerEmail),
    loadType: limited(raw.loadType, 80, "Load"),
    weightKg: optionalNumber(raw.weightKg, "Weight", 200000),
    deadlineAt: text(raw.deadlineAt) ? requiredInstant(raw.deadlineAt, "Deadline") : null,
    notes: limited(raw.notes, 500, "Notes"),
    driverId: requiredUuid(raw.driverId, "Driver"),
    vehicleId: requiredUuid(raw.vehicleId, "Truck"),
    emptyRun: raw.emptyRun === true,
    etaAt: text(raw.etaAt) ? requiredInstant(raw.etaAt, "ETA") : null,
    stops,
  };
}

export function parseTripStatus(body: unknown): string {
  const raw = asObject(body);
  return choice(raw.status, TRIP_STATUSES, "Status");
}

export function parseApiKeyName(body: unknown): string {
  const raw = asObject(body);
  const name = limited(raw.name, 80, "Key name");
  if (!name) throw new Error("Key name is required");
  return name;
}

export function parseNotifications(body: unknown): NotificationPreference[] {
  const raw = asObject(body);
  if (!Array.isArray(raw.items)) throw new Error("Missing details");
  return raw.items.map((item) => {
    const row = asObject(item);
    const kind = choice(row.kind, ALERT_KINDS, "Alert");
    const channel = choice(row.channel, ALERT_CHANNELS, "Channel");
    return { kind, channel, enabled: row.enabled === true };
  });
}

function coordinate(value: unknown, label: string, min: number, max: number): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(text(value));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} is not valid`);
  }
  return parsed;
}

function requiredInstant(value: unknown, label: string): string {
  const raw = text(value);
  if (!raw) throw new Error(`${label} is required`);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} must be a real date`);
  return parsed.toISOString();
}
