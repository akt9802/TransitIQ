import { notFound, redirect } from "next/navigation";
import PrintButton from "@/components/dashboard/PrintButton";
import { ensureAuthSchema } from "@/lib/auth/schema";
import { getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/company/queries";
import { TRIP_STATUSES, type TripCost } from "@/lib/company/types";

export const dynamic = "force-dynamic";

function inr(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

function when(iso: string | null) {
  if (!iso) return "Time not set";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

const KIND: Record<TripCost["lines"][number]["kind"], string> = {
  fuel: "Fuel",
  puncture: "Tyre puncture",
  engine: "Engine",
  other: "Other",
};

const TIMING: Record<TripCost["lines"][number]["timing"], string> = {
  before_trip: "Before the trip",
  on_trip: "On the trip",
  after_trip: "After the trip",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Trip cost ${id.slice(0, 8)} — TransitIQ` };
}

export default async function TripCostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  await ensureAuthSchema();
  const workspace = await getWorkspace(session.sub);
  if (!workspace?.company || !workspace.permissions.includes("trips.read")) notFound();
  if (workspace.owner.roleKey === "driver") notFound();
  const trip = workspace.trips.find((item) => item.id === id);
  if (!trip) notFound();
  const cost = trip.cost;
  const status = TRIP_STATUSES.find((item) => item.key === trip.status)?.label ?? trip.status;
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-8">
      <PrintButton />
      <p className="mt-6 text-sm text-ink-soft">{workspace.company.name}</p>
      <h1 className="mt-1 text-3xl font-extrabold text-ink">Trip cost</h1>
      <p className="mt-2 text-lg font-extrabold text-ink">{trip.customerName}</p>
      <p className="mt-1 text-sm text-ink">
        {status}
        {trip.driverName ? ` · ${trip.driverName}` : ""}
        {trip.vehicleRegistration ? ` · ${trip.vehicleRegistration}` : ""}
        {trip.loadType ? ` · ${trip.loadType}` : ""}
        {trip.weightKg != null ? ` · ${trip.weightKg} kg` : ""}
      </p>
      <p className="mt-1 text-sm text-muted">
        {trip.startedAt ? `Started ${when(trip.startedAt)}` : "Not started"}
        {trip.completedAt ? ` · Finished ${when(trip.completedAt)}` : ""}
        {trip.deadlineAt ? ` · Deadline ${when(trip.deadlineAt)}` : ""}
      </p>
      <ol className="mt-4 space-y-1">
        {trip.stops.map((stop, index) => (
          <li key={stop.id} className="text-sm text-ink">
            {index + 1}. {stop.address ?? "Place not set"}
          </li>
        ))}
      </ol>

      <table className="mt-6 w-full border-2 border-ink text-left text-sm">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="px-3 py-2">What</th>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Detail</th>
            <th className="px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {cost.lines.length === 0 ? (
            <tr>
              <td className="px-3 py-3 text-muted" colSpan={4}>
                No fuel or other cost is linked to this trip.
              </td>
            </tr>
          ) : (
            cost.lines.map((line) => (
              <tr key={line.id} className="border-t border-ink/20">
                <td className="px-3 py-2">{KIND[line.kind]}</td>
                <td className="px-3 py-2">{TIMING[line.timing]}</td>
                <td className="px-3 py-2">
                  {line.detail}
                  {line.litres != null ? ` · ${line.litres} L` : ""}
                  <span className="block text-muted">{when(line.at)}</span>
                </td>
                <td className="px-3 py-2 text-right">{inr(line.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt>Fuel</dt>
          <dd className="font-extrabold">{inr(cost.fuelAmount)} · {cost.fuelLitres} L</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Other costs</dt>
          <dd className="font-extrabold">{inr(cost.extraAmount)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Driver pay</dt>
          <dd className="font-extrabold">{cost.payAmount == null ? "Not added" : inr(cost.payAmount)}</dd>
        </div>
        <p className="text-muted">{cost.payNote} Tracked distance on this trip is {cost.kilometres.toLocaleString("en-IN")} km.</p>
        <div className="flex justify-between gap-4 border-t-2 border-ink pt-2 text-base">
          <dt className="font-extrabold">Total</dt>
          <dd className="font-extrabold">{inr(cost.total)}</dd>
        </div>
        {cost.payAmount == null ? <p>This total does not include driver pay.</p> : null}
        {trip.status !== "completed" && trip.status !== "closed" && trip.status !== "canceled" ? (
          <p>This trip is still open. Later fuel, bills, and kilometres are added when they are recorded.</p>
        ) : null}
      </dl>
      <p className="mt-6 text-sm text-muted">
        A fill or bill with no trip is left out. Kilometres skip a gap over 20 minutes and a jump over 20 km, the same rule as Performance. A monthly salary is not split onto this trip.
      </p>
    </main>
  );
}
