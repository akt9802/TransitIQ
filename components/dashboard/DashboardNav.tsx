import Link from "next/link";
import TruckLogo from "@/components/icons/TruckLogo";
import {
  AlertIcon,
  BuildingIcon,
  DropIcon,
  PeopleIcon,
  PersonIcon,
  PulseIcon,
  RouteIcon,
  StarIcon,
} from "@/components/icons/Marks";

export type DashboardSection = "company" | "people" | "vehicles" | "drivers" | "trips" | "performance" | "fuel" | "points" | "roads";

type Item = {
  section: DashboardSection;
  label: string;
  href: string;
  count?: number;
};

type Props = {
  fleetName: string;
  active: DashboardSection;
  items: Item[];
  kicker?: string;
};

function SectionIcon({ section }: { section: DashboardSection }) {
  const className = "h-4 w-4 shrink-0";
  if (section === "company") return <BuildingIcon className={className} />;
  if (section === "people") return <PeopleIcon className={className} />;
  if (section === "vehicles") return <TruckLogo className={className} decorative />;
  if (section === "drivers") return <PersonIcon className={className} />;
  if (section === "trips") return <RouteIcon className={className} />;
  if (section === "performance") return <PulseIcon className={className} />;
  if (section === "fuel") return <DropIcon className={className} />;
  if (section === "points") return <StarIcon className={className} />;
  return <AlertIcon className={className} />;
}

export default function DashboardNav({ fleetName, active, items, kicker = "Fleet" }: Props) {
  return (
    <aside className="lg:sticky lg:top-24 lg:w-56 lg:shrink-0">
      <p className="px-3 text-xs font-bold text-muted">{kicker}</p>
      <p className="break-words px-3 text-lg font-extrabold tracking-tight text-ink">{fleetName}</p>
      <nav className="mt-4 flex gap-2 overflow-x-auto lg:max-h-[calc(100vh-8rem)] lg:flex-col lg:overflow-y-auto" aria-label="Sections">
        {items.map((item) => {
          const current = item.section === active;
          return (
            <Link
              key={item.section}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={`flex shrink-0 items-center justify-between gap-3 rounded-md border-2 px-3 py-2.5 text-sm no-underline transition duration-150 ${
                current
                  ? "border-ink bg-ink font-extrabold text-paper"
                  : "border-transparent text-ink hover:border-ink hover:bg-accent-soft"
              }`}
            >
              <span className="flex items-center gap-2">
                <SectionIcon section={item.section} />
                {item.label}
              </span>
              {item.count != null ? (
                <span className={current ? "text-paper" : "text-muted"}>{item.count}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
