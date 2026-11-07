"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardNav, { type DashboardSection } from "@/components/dashboard/DashboardNav";
import DriversSection from "@/components/dashboard/DriversSection";
import FuelSection from "@/components/dashboard/FuelSection";
import PeopleSection from "@/components/dashboard/PeopleSection";
import PaperReminders from "@/components/dashboard/PaperReminders";
import PerformanceSection from "@/components/dashboard/PerformanceSection";
import TripTracker from "@/components/dashboard/TripTracker";
import TripsSection from "@/components/dashboard/TripsSection";
import { Alert } from "@/components/dashboard/frame";
import { fieldClass, labelClass, primaryBtn, quietBtn } from "@/components/dashboard/styles";
import VehiclesSection from "@/components/dashboard/VehiclesSection";
import type { CompanyInput, Language, Workspace } from "@/lib/company/types";

type FormState = {
  fullName: string;
  phone: string;
  address: string;
  language: Language;
  companyName: string;
  legalName: string;
  gstin: string;
  companyPhone: string;
  companyEmail: string;
  companyAddress: string;
};

function fromWorkspace(workspace: Workspace): FormState {
  return {
    fullName: workspace.owner.fullName ?? "",
    phone: workspace.owner.phone ?? "",
    address: workspace.owner.address ?? "",
    language: workspace.owner.language,
    companyName: workspace.company?.name ?? "",
    legalName: workspace.company?.legalName ?? "",
    gstin: workspace.company?.gstin ?? "",
    companyPhone: workspace.company?.phone ?? "",
    companyEmail: workspace.company?.email ?? "",
    companyAddress: workspace.company?.address ?? "",
  };
}

function payload(form: FormState): CompanyInput {
  return {
    fullName: form.fullName,
    phone: form.phone,
    address: form.address,
    language: form.language,
    companyName: form.companyName,
    legalName: form.legalName,
    gstin: form.gstin,
    companyPhone: form.companyPhone,
    companyEmail: form.companyEmail,
    companyAddress: form.companyAddress,
  };
}

function shown(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "Not added";
}

function planLabel(plan: string): string {
  if (plan === "pro") return "Pro";
  return "Free";
}

const SECTIONS: DashboardSection[] = ["company", "people", "vehicles", "drivers", "trips", "performance", "fuel"];

function requestedSection(value: string | undefined): DashboardSection | null {
  return SECTIONS.find((section) => section === value) ?? null;
}

export default function OwnerDashboard({
  workspace,
  section,
}: {
  workspace: Workspace;
  section?: string;
}) {
  const router = useRouter();
  const hasCompany = Boolean(workspace.company);
  const canEditCompany = workspace.permissions.includes("company.write");
  const canSeeCompany = workspace.permissions.includes("company.read") || canEditCompany;
  const canSeePeople = workspace.permissions.includes("people.read");
  const canSeeVehicles = workspace.permissions.includes("vehicles.read");
  const canSeeDrivers = workspace.permissions.includes("drivers.read");
  const canSeeTrips = workspace.permissions.includes("trips.read");
  const link = (section: DashboardSection, label: string, count?: number) => ({
    section,
    label,
    href: section === "company" ? "/dashboard" : `/dashboard?section=${section}`,
    count,
  });
  const navItems = [
    canSeeCompany ? link("company", "Company") : null,
    canSeePeople ? link("people", "People", workspace.people.length) : null,
    canSeeVehicles ? link("vehicles", "Vehicles", workspace.vehicles.length) : null,
    canSeeDrivers ? link("drivers", "Drivers", workspace.drivers.length) : null,
    canSeeTrips
      ? link(
          "trips",
          "Trips",
          workspace.trips.filter((trip) => trip.status === "assigned" || ["started", "loading", "in_transit", "unloading"].includes(trip.status)).length
        )
      : null,
    canSeeTrips ? link("performance", workspace.owner.roleKey === "driver" ? "My day" : "Performance") : null,
    canSeeTrips ? link("fuel", "Fuel") : null,
  ].filter((item) => item !== null);
  const requested = requestedSection(section);
  const active =
    navItems.find((item) => item.section === requested)?.section ?? navItems[0]?.section ?? "company";
  const [editing, setEditing] = useState(!hasCompany);

  useEffect(() => {
    if (hasCompany) setEditing(false);
  }, [active, hasCompany]);
  const [form, setForm] = useState<FormState>(() => fromWorkspace(workspace));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/company", {
        method: hasCompany ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(form)),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const title = workspace.company?.name ?? "Set up your fleet";
  const intro = hasCompany
    ? "These details are used on invoices and the tracking page."
    : "Add your name and the company this account will own.";

  return (
    <main
      id="main"
      className={`mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 ${
        hasCompany ? "lg:flex-row lg:items-start" : ""
      }`}
    >
      {hasCompany && workspace.company ? (
        <DashboardNav fleetName={workspace.company.name} active={active} items={navItems} />
      ) : null}

      <div className="min-w-0 flex-1">
      {hasCompany && workspace.owner.roleKey !== "driver" ? <PaperReminders /> : null}
      {!hasCompany || active === "company" ? (
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">{intro}</p>
        </div>
        {hasCompany && canEditCompany && !editing && active === "company" ? (
          <button
            type="button"
            className={quietBtn}
            onClick={() => {
              setForm(fromWorkspace(workspace));
              setError(null);
              setEditing(true);
            }}
          >
            Edit
          </button>
        ) : null}
      </div>
      ) : null}

      {error && (!hasCompany || active === "company") ? (
        <Alert message={error} onClose={() => setError(null)} />
      ) : null}

      {hasCompany && !editing && workspace.company && navItems.length === 0 ? (
        <p className="mt-8 text-sm text-ink-soft">
          You are signed in to {workspace.company.name}. The owner manages this fleet.
        </p>
      ) : null}

      {hasCompany && !editing && workspace.company && active === "company" && canSeeCompany ? (
        <div className="mt-8">
          <div className="grid items-start gap-4 md:grid-cols-2">
            <section className="border-2 border-ink bg-paper-subtle p-5 shadow-[var(--shadow-brutal)]">
              <h2 className="text-lg font-extrabold text-ink">Company</h2>
              <dl className="mt-3">
                <Fact label="Fleet name" value={workspace.company.name} />
                <Fact label="Legal name" value={shown(workspace.company.legalName)} />
                <Fact label="GSTIN" value={shown(workspace.company.gstin)} />
                <Fact label="Phone" value={shown(workspace.company.phone)} />
                <Fact label="Email" value={shown(workspace.company.email)} />
                <Fact label="Address" value={shown(workspace.company.address)} />
                <Fact
                  label="Plan"
                  value={`${planLabel(workspace.subscription?.plan ?? workspace.company.plan)} · ${workspace.subscription?.status ?? "active"} · up to ${workspace.company.vehicleLimit} trucks`}
                />
              </dl>
            </section>
            <section className="border-2 border-ink bg-paper-subtle p-5 shadow-[var(--shadow-brutal)]">
              <h2 className="text-lg font-extrabold text-ink">You</h2>
              <dl className="mt-3">
                <Fact label="Name" value={shown(workspace.owner.fullName)} />
                <Fact label="Role" value={workspace.owner.roleName ?? "Owner"} />
                <Fact label="Email" value={workspace.owner.email} />
                <Fact label="Phone" value={shown(workspace.owner.phone)} />
                <Fact label="Address" value={shown(workspace.owner.address)} />
                <Fact label="Language" value={workspace.owner.language === "hi" ? "Hindi" : "English"} />
              </dl>
            </section>
          </div>
        </div>
      ) : null}

      {hasCompany && active === "people" && canSeePeople ? (
        <PeopleSection
          people={workspace.people}
          canWrite={workspace.permissions.includes("people.write")}
        />
      ) : null}

      {hasCompany && active === "vehicles" && canSeeVehicles && workspace.company ? (
        <VehiclesSection
          vehicles={workspace.vehicles}
          vehicleLimit={workspace.company.vehicleLimit}
          canWrite={workspace.permissions.includes("vehicles.write")}
          papers={workspace.vehiclePapers}
        />
      ) : null}

      {hasCompany && active === "drivers" && canSeeDrivers ? (
        <DriversSection
          drivers={workspace.drivers}
          people={workspace.people}
          papers={workspace.driverPapers}
          canWrite={workspace.permissions.includes("drivers.write")}
        />
      ) : null}

      {hasCompany && workspace.owner.roleKey === "driver"
        ? (() => {
            const liveTrip = workspace.trips.find((trip) =>
              ["started", "loading", "in_transit", "unloading"].includes(trip.status)
            );
            return liveTrip ? <TripTracker tripId={liveTrip.id} /> : null;
          })()
        : null}

      {hasCompany && active === "trips" && canSeeTrips ? (
        <TripsSection
          trips={workspace.trips}
          customers={workspace.customers}
          drivers={workspace.drivers}
          vehicles={workspace.vehicles}
          canWrite={workspace.permissions.includes("trips.write")}
          ownDriverId={workspace.owner.roleKey === "driver" ? workspace.owner.driverId : null}
        />
      ) : null}

      {hasCompany && active === "performance" && canSeeTrips ? (
        <PerformanceSection mine={workspace.owner.roleKey === "driver"} />
      ) : null}

      {hasCompany && active === "fuel" && canSeeTrips ? (
        <FuelSection
          mine={workspace.owner.roleKey === "driver"}
          vehicles={workspace.vehicles}
          trips={workspace.trips.map((trip) => ({
            id: trip.id,
            status: trip.status,
            customerName: trip.customerName,
            vehicleId: trip.vehicleId,
            vehicleRegistration: trip.vehicleRegistration,
            completedAt: trip.completedAt,
          }))}
        />
      ) : null}

      {!hasCompany || (editing && active === "company") ? (
        <form
          onSubmit={save}
          className="mt-8 border-2 border-ink bg-paper-subtle p-5 shadow-[var(--shadow-brutal)] sm:p-6"
        >
          <div className="grid gap-8 md:grid-cols-2">
            <fieldset className="min-w-0 space-y-4">
              <legend className="text-lg font-extrabold text-ink">You</legend>
              <label className={labelClass}>
                Full name
                <input
                  required
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  className={fieldClass}
                  autoComplete="name"
                />
              </label>
              <label className={labelClass}>
                Email
                <input value={workspace.owner.email} readOnly className={`${fieldClass} text-muted`} />
              </label>
              <label className={labelClass}>
                Phone
                <input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className={fieldClass}
                  autoComplete="tel"
                  inputMode="tel"
                />
              </label>
              <label className={labelClass}>
                Address
                <textarea
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  className={`${fieldClass} min-h-24 resize-y`}
                  autoComplete="street-address"
                />
              </label>
              <label className={labelClass}>
                Language
                <select
                  value={form.language}
                  onChange={(e) => set("language", e.target.value === "hi" ? "hi" : "en")}
                  className={fieldClass}
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                </select>
              </label>
            </fieldset>

            <fieldset className="min-w-0 space-y-4">
              <legend className="text-lg font-extrabold text-ink">Company</legend>
              <label className={labelClass}>
                Fleet name
                <input
                  required
                  value={form.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                  className={fieldClass}
                  autoComplete="organization"
                />
              </label>
              <label className={labelClass}>
                Legal name
                <input
                  value={form.legalName}
                  onChange={(e) => set("legalName", e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className={labelClass}>
                GSTIN
                <input
                  value={form.gstin}
                  onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                  className={fieldClass}
                  maxLength={15}
                  autoCapitalize="characters"
                />
              </label>
              <label className={labelClass}>
                Phone
                <input
                  value={form.companyPhone}
                  onChange={(e) => set("companyPhone", e.target.value)}
                  className={fieldClass}
                  inputMode="tel"
                />
              </label>
              <label className={labelClass}>
                Email
                <input
                  type="email"
                  value={form.companyEmail}
                  onChange={(e) => set("companyEmail", e.target.value)}
                  className={fieldClass}
                  autoComplete="email"
                />
              </label>
              <label className={labelClass}>
                Address
                <textarea
                  value={form.companyAddress}
                  onChange={(e) => set("companyAddress", e.target.value)}
                  className={`${fieldClass} min-h-24 resize-y`}
                />
              </label>
            </fieldset>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button type="submit" className={primaryBtn} disabled={saving}>
              {saving ? "Saving…" : hasCompany ? "Save changes" : "Save fleet"}
            </button>
            {hasCompany ? (
              <button
                type="button"
                className={quietBtn}
                disabled={saving}
                onClick={() => {
                  setForm(fromWorkspace(workspace));
                  setError(null);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-ink/15 py-3 first:border-t-0 first:pt-0">
      <dt className={labelClass}>{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  );
}
