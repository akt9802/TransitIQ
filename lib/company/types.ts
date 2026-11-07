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
  branchId: string | null;
  branchName: string | null;
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
  branchId: string | null;
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
  branchId: string | null;
  branchName: string | null;
  vendorId: string | null;
  vendorName: string | null;
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
  branchId: string | null;
  vendorId: string | null;
};

export type BranchRecord = { id: string; name: string; address: string | null };

export type VendorRecord = { id: string; name: string; phone: string | null; gstin: string | null };

export type DriverRecord = {
  id: string;
  fullName: string;
  phone: string;
  address: string | null;
  branchId: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  licenseNumber: string | null;
  licenseClass: string | null;
  licenseExpiresOn: string | null;
  licenseEndorsements: string | null;
  payType: string;
  payRate: number | null;
  status: string;
  userId: string | null;
};

export type DriverInput = {
  fullName: string;
  phone: string;
  address: string | null;
  branchId: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  licenseNumber: string | null;
  licenseClass: string | null;
  licenseExpiresOn: string | null;
  licenseEndorsements: string | null;
  payType: string;
  payRate: number | null;
  status: string;
  userId: string | null;
};

export type PaperRecord = {
  id: string;
  parentId: string;
  kind: string;
  documentNumber: string | null;
  fileKey: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
};

export type PaperInput = {
  parentId: string;
  kind: string;
  documentNumber: string | null;
  fileKey: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
};

export type DeviceRecord = {
  id: string;
  kind: string;
  externalId: string;
  vehicleId: string | null;
  driverId: string | null;
  lastSeenAt: string | null;
};

export type DeviceInput = {
  kind: string;
  externalId: string;
  vehicleId: string | null;
  driverId: string | null;
};

export type ShiftRecord = {
  id: string;
  driverId: string;
  vehicleId: string | null;
  startsAt: string;
  endsAt: string;
};

export type AttendanceRecord = {
  id: string;
  driverId: string;
  day: string;
  kind: string;
  note: string | null;
};

export type HosRecord = {
  id: string;
  driverId: string;
  kind: string;
  startedAt: string;
  endedAt: string | null;
};

export type PointRecord = {
  id: string;
  driverId: string;
  points: number;
  reason: string;
  sourceType: string | null;
  createdAt: string;
};

export type SubscriptionRecord = {
  plan: string;
  status: string;
  vehicleLimit: number;
};

export type ApiKeyRecord = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type NotificationPreference = {
  kind: string;
  channel: string;
  enabled: boolean;
};

export const PAY_TYPES = [
  { key: "per_trip", label: "Per trip" },
  { key: "per_km", label: "Per km" },
  { key: "salary", label: "Salary" },
] as const;

export const DRIVER_STATUSES = [
  { key: "active", label: "Active" },
  { key: "on_leave", label: "On leave" },
  { key: "inactive", label: "Inactive" },
] as const;

export const VEHICLE_DOC_KINDS = [
  { key: "rc", label: "RC" },
  { key: "insurance", label: "Insurance" },
  { key: "permit", label: "Permit" },
  { key: "fitness", label: "Fitness" },
  { key: "pollution", label: "Pollution" },
  { key: "road_tax", label: "Road tax" },
] as const;

export const DRIVER_DOC_KINDS = [
  { key: "license", label: "License" },
  { key: "other", label: "Other" },
] as const;

export const DEVICE_KINDS = [
  { key: "gps", label: "GPS device" },
  { key: "phone", label: "Phone" },
] as const;

export const ATTENDANCE_KINDS = [
  { key: "present", label: "Present" },
  { key: "absent", label: "Absent" },
  { key: "leave", label: "Leave" },
] as const;

export const HOS_KINDS = [
  { key: "driving", label: "Driving" },
  { key: "rest", label: "Rest" },
] as const;

export const ALERT_KINDS = [
  { key: "expiry", label: "Document expiry" },
  { key: "delay", label: "Delay" },
  { key: "hazard", label: "Hazard" },
  { key: "repair", label: "Repair" },
  { key: "payment", label: "Payment" },
] as const;

export const ALERT_CHANNELS = [
  { key: "push", label: "Push" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "in_app", label: "In app" },
] as const;

export type Workspace = {
  owner: OwnerProfile;
  company: CompanyRecord | null;
  people: PersonRecord[];
  vehicles: VehicleRecord[];
  branches: BranchRecord[];
  vendors: VendorRecord[];
  drivers: DriverRecord[];
  vehiclePapers: PaperRecord[];
  driverPapers: PaperRecord[];
  devices: DeviceRecord[];
  shifts: ShiftRecord[];
  attendance: AttendanceRecord[];
  hosLogs: HosRecord[];
  pointEvents: PointRecord[];
  subscription: SubscriptionRecord | null;
  apiKeys: ApiKeyRecord[];
  notifications: NotificationPreference[];
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
