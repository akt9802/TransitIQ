export type Language = "en" | "hi";

export type OwnerProfile = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  address: string | null;
  language: Language;
  roleKey: string | null;
  roleName: string | null;
};

export type CompanyRecord = {
  id: string;
  name: string;
  legalName: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  plan: string;
  vehicleLimit: number;
};

export type PersonRecord = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  roleKey: string | null;
  roleName: string | null;
  hasLogin: boolean;
};

export const ASSIGNABLE_ROLES = [
  { key: "fleet_manager", label: "Fleet manager" },
  { key: "dispatcher", label: "Dispatcher" },
  { key: "accountant", label: "Accountant" },
  { key: "driver", label: "Driver" },
  { key: "mechanic", label: "Mechanic" },
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]["key"];

export type PersonInput = {
  fullName: string;
  email: string;
  phone: string | null;
  roleKey: AssignableRole;
};

export const TRUCK_TYPES = [
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "trailer", label: "Trailer" },
  { key: "tanker", label: "Tanker" },
  { key: "container", label: "Container" },
] as const;

export const VEHICLE_OWNERSHIP = [
  { key: "owned", label: "Owned" },
  { key: "leased", label: "Leased" },
  { key: "attached", label: "Attached" },
] as const;

export const VEHICLE_STATUSES = [
  { key: "active", label: "Active" },
  { key: "idle", label: "Idle" },
  { key: "maintenance", label: "Under maintenance" },
  { key: "retired", label: "Retired" },
] as const;

export type VehicleRecord = {
  id: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  chassisNumber: string | null;
  engineNumber: string | null;
  truckType: string;
  loadCapacityKg: number | null;
  axleCount: number | null;
  lengthM: number | null;
  widthM: number | null;
  heightM: number | null;
  ownership: string;
  contractStart: string | null;
  contractEnd: string | null;
  status: string;
  odometerKm: number | null;
  tankCapacityL: number | null;
};

export type VehicleInput = {
  registrationNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  chassisNumber: string | null;
  engineNumber: string | null;
  truckType: string;
  loadCapacityKg: number | null;
  axleCount: number | null;
  lengthM: number | null;
  widthM: number | null;
  heightM: number | null;
  ownership: string;
  contractStart: string | null;
  contractEnd: string | null;
  status: string;
  odometerKm: number | null;
  tankCapacityL: number | null;
};

export type Workspace = {
  owner: OwnerProfile;
  company: CompanyRecord | null;
  people: PersonRecord[];
  vehicles: VehicleRecord[];
  permissions: string[];
};

export type CompanyInput = {
  fullName: string;
  phone: string | null;
  address: string | null;
  language: Language;
  companyName: string;
  legalName: string | null;
  gstin: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyAddress: string | null;
};
