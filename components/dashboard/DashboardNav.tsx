import Link from "next/link";

export type DashboardSection = "company" | "people" | "branches" | "vehicles" | "drivers";

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
};

export default function DashboardNav({ fleetName, active, items }: Props) {
  return (
    <aside className="lg:sticky lg:top-24 lg:w-56 lg:shrink-0">
      <p className="px-3 text-xs font-bold text-muted">Fleet</p>
      <p className="break-words px-3 text-lg font-extrabold tracking-tight text-ink">{fleetName}</p>
      <nav className="mt-4 flex gap-2 overflow-x-auto lg:max-h-[calc(100vh-8rem)] lg:flex-col lg:overflow-y-auto" aria-label="Fleet sections">
        {items.map((item) => {
          const current = item.section === active;
          return (
            <Link
              key={item.section}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={`flex shrink-0 items-center justify-between gap-3 rounded-md border-2 px-3 py-2.5 text-sm no-underline ${
                current
                  ? "border-ink bg-ink font-extrabold text-paper"
                  : "border-transparent text-ink hover:border-ink hover:bg-paper"
              }`}
            >
              {item.label}
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
