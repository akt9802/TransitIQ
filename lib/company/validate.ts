import type {
  AssignableRole,
  CompanyInput,
  Language,
  PersonInput,
  VehicleInput,
} from "@/lib/company/types";
import { ASSIGNABLE_ROLES, TRUCK_TYPES, VEHICLE_OWNERSHIP, VEHICLE_STATUSES } from "@/lib/company/types";

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
    ownership: choice(raw.ownership, VEHICLE_OWNERSHIP, "Ownership", "owned"),
    contractStart,
    contractEnd,
    status: choice(raw.status, VEHICLE_STATUSES, "Status", "active"),
    odometerKm: optionalNumber(raw.odometerKm, "Odometer", 10000000),
    tankCapacityL: optionalNumber(raw.tankCapacityL, "Tank capacity", 2000),
  };
}
