import { notFound } from "next/navigation";
import CustomerTrack from "@/components/track/CustomerTrack";
import { customerTracking } from "@/lib/company/tracking-link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your shipment — TransitIQ",
  description: "Private shipment status, latest place, and photos.",
};

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await customerTracking(token);
  if (!view) notFound();
  return <CustomerTrack token={token} initial={view} />;
}
