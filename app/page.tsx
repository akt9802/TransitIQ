import CorridorMap from "@/components/maps/CorridorMap";
import TruckLogo from "@/components/icons/TruckLogo";

const OFFERINGS = [
  {
    title: "Fleet",
    body: "GPS, trips, drivers, maintenance, fuel and compliance in one place.",
  },
  {
    title: "Road safety",
    body: "Drivers report hazards; authorities and contractors close the loop.",
  },
  {
    title: "Routing",
    body: "Safer, faster routes with hazard context — not just the shortest path.",
  },
] as const;

const HOW_STEPS = [
  {
    title: "Assign and dispatch",
    body: "Dispatch creates the trip, the driver gets the corridor, and live position updates every few seconds.",
  },
  {
    title: "Spot hazards early",
    body: "Potholes, waterlogging and closures surface on the same map your fleet already watches.",
  },
  {
    title: "Close the loop",
    body: "Authorities see tickets, contractors update status, and everyone knows when the road is clear again.",
  },
] as const;

const AUDIENCES = [
  {
    title: "Fleet & dispatch",
    items: [
      "Ops teams running 5–500 trucks",
      "Owner-drivers who want fewer phone calls",
      "Anyone tired of WhatsApp + spreadsheets",
    ],
  },
  {
    title: "Road & infra",
    items: [
      "Municipal and highway agencies",
      "Contractors responsible for repairs",
      "Teams that need proof and timelines",
    ],
  },
] as const;

const FAQ = [
  {
    q: "Is the map preview real GPS data?",
    a: "No — it illustrates the Mumbai–Pune corridor with sample stops. Live fleet data connects when you’re on the product.",
  },
  {
    q: "Do drivers need a separate app?",
    a: "Drivers use a focused mobile experience for trips, check-ins and hazard reports; dispatch stays on the web.",
  },
  {
    q: "What happens after I email you?",
    a: "We reply with a short call to understand your lanes, vehicles and compliance needs, then share a tailored rollout plan.",
  },
] as const;

/** One horizontal rhythm: less side margin, aligned across header → footer. */
const SHELL =
  "mx-auto w-full max-w-7xl px-3 sm:px-4 md:px-5 lg:px-6";
const SECTION_Y = "py-14 md:py-20";

const PLANS = [
  {
    name: "Starter",
    price: "₹499",
    unit: "/ truck / month",
    note: "Free for up to 3 trucks",
    items: ["Live tracking", "Trips & history", "Document reminders"],
    featured: false,
  },
  {
    name: "Pro",
    price: "₹799",
    unit: "/ truck / month",
    note: "Full fleet ops",
    items: ["Geofences", "Maintenance & fuel", "Reports & API"],
    featured: true,
  },
  {
    name: "Authority",
    price: "Custom",
    unit: "for regions",
    note: "Road agencies",
    items: ["Hazard console", "Tickets", "Analytics"],
    featured: false,
  },
] as const;

export const metadata = {
  title: "TransitIQ — Fleet and roads, one place",
  description:
    "Fleet management and road safety for Indian trucking. Simple, clear, built to scale.",
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper font-sans text-ink antialiased">
      <main id="main">
        {/* Hero */}
        <section className="border-b-2 border-ink bg-paper">
          <div
            className={`flex flex-col gap-10 lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-12 ${SHELL} ${SECTION_Y}`}
          >
            <div className="relative order-2 flex flex-col justify-center overflow-hidden rounded-[var(--radius-card)] border-2 border-ink p-6 shadow-[var(--shadow-brutal)] lg:order-1 lg:p-10">
              {/* Graph-paper grid + soft tint (map unchanged elsewhere). */}
              <div
                className="pointer-events-none absolute inset-0 rounded-[inherit]"
                style={{
                  backgroundImage: [
                    "linear-gradient(145deg, oklch(99% 0.03 250) 0%, oklch(94% 0.06 250 / 0.88) 50%, var(--color-accent-soft) 100%)",
                    "repeating-linear-gradient(90deg, transparent 0, transparent 19px, rgba(15,23,42,0.07) 19px, rgba(15,23,42,0.07) 20px)",
                    "repeating-linear-gradient(0deg, transparent 0, transparent 19px, rgba(15,23,42,0.07) 19px, rgba(15,23,42,0.07) 20px)",
                    "repeating-linear-gradient(90deg, transparent 0, transparent 99px, rgba(15,23,42,0.12) 99px, rgba(15,23,42,0.12) 100px)",
                    "repeating-linear-gradient(0deg, transparent 0, transparent 99px, rgba(15,23,42,0.12) 99px, rgba(15,23,42,0.12) 100px)",
                  ].join(", "),
                }}
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_78%_16%,oklch(72%_0.14_264/0.18),transparent_52%)]"
                aria-hidden
              />
              <p className="relative z-[1] mb-4 text-[11px] font-extrabold uppercase tracking-[0.22em] text-accent">
                Fleet · Roads · India
              </p>
              <h1 className="relative z-[1] text-4xl font-extrabold leading-[1.05] tracking-tight md:text-[2.65rem] lg:text-[2.85rem]">
                Run your fleet.
                <br />
                Fix the road.
              </h1>
              <p className="relative z-[1] mt-6 max-w-lg text-sm leading-relaxed text-ink-soft md:text-base">
                Live fleet control and hazard reporting on one map — dispatch sees
                positions, crews see tickets, and everyone agrees on what happened
                where.
              </p>
              <div className="relative z-[1] mt-8 flex flex-wrap gap-3">
                <a
                  href="#pricing"
                  className="inline-flex items-center rounded-md border-2 border-ink bg-accent px-6 py-3 text-xs font-extrabold uppercase tracking-wider text-accent-ink shadow-[var(--shadow-brutal-sm)] transition duration-150 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-[var(--shadow-brutal-accent)] active:translate-y-0 active:shadow-none"
                >
                  See pricing
                </a>
                <a
                  href="mailto:hello@transitiq.in"
                  className="inline-flex items-center rounded-md border-2 border-ink bg-paper px-6 py-3 text-xs font-extrabold uppercase tracking-wider text-ink shadow-[var(--shadow-brutal-sm)] transition duration-150 hover:-translate-y-0.5 hover:bg-accent-soft hover:shadow-[var(--shadow-brutal)] active:translate-y-0 active:shadow-none"
                >
                  Talk to us
                </a>
              </div>
            </div>

            <div
              id="map"
              className="order-1 flex scroll-mt-24 flex-col gap-3 lg:order-2 lg:min-h-0"
            >
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal">
                    Live preview
                  </p>
                  <p className="mt-1 text-base font-extrabold md:text-lg">
                    Mumbai → Pune corridor
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-muted md:text-sm">
                    Standard Google map with the sample corridor highlighted. Pan and
                    zoom — the view refits when you resize.
                  </p>
                </div>
                <span className="rounded-md border-2 border-ink bg-paper-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  Sample route
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-md border-2 border-ink shadow-[var(--shadow-brutal)]">
                <CorridorMap />
              </div>
            </div>
          </div>
        </section>

        {/* Product */}
        <section
          id="offer"
          className="scroll-mt-20 border-b-2 border-ink bg-gradient-to-b from-paper-muted/60 to-paper"
        >
          <div className={`${SHELL} ${SECTION_Y}`}>
            <div className="max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
                Product
              </p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
                What TransitIQ is
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft md:text-base">
                One product for operators who move freight and one mode for agencies
                that own the road — same incidents, same timestamps, less back-and-forth.
              </p>
            </div>
            <ul className="mt-12 grid gap-5 sm:grid-cols-3">
              {OFFERINGS.map((item, i) => (
                <li
                  key={item.title}
                  className="group flex flex-col rounded-md border-2 border-ink bg-paper p-6 shadow-[var(--shadow-brutal-sm)] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-brutal)]"
                >
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <span className="text-xl font-extrabold tabular-nums leading-none text-muted/80">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-accent-soft transition group-hover:bg-accent">
                      <TruckLogo
                        className="h-6 w-6 text-accent group-hover:text-accent-ink"
                        decorative
                      />
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold tracking-tight">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how"
          className="scroll-mt-20 border-b-2 border-ink bg-paper"
        >
          <div className={`${SHELL} ${SECTION_Y}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal">
              Flow
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
              How it works
            </h2>
            <p className="mt-4 max-w-2xl text-sm text-ink-soft md:text-base">
              Three steps from dispatch to a safer road — you can start with fleet only
              and add authority tools when your region is ready.
            </p>
            <ol className="mt-12 space-y-8 border-l-2 border-accent/40 pl-6 md:pl-10">
              {HOW_STEPS.map((step, i) => (
                <li key={step.title} className="relative">
                  <span className="absolute -left-[29px] top-0 flex h-7 w-7 items-center justify-center rounded-md border-2 border-ink bg-accent text-xs font-extrabold text-accent-ink md:-left-[45px] md:h-8 md:w-8">
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-extrabold">{step.title}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Who it's for */}
        <section
          id="who"
          className="scroll-mt-20 border-b-2 border-ink bg-paper-muted/35"
        >
          <div className={`${SHELL} ${SECTION_Y}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent">
              Audiences
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
              Who it&apos;s for
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {AUDIENCES.map((block) => (
                <div
                  key={block.title}
                  className="rounded-md border-2 border-ink bg-paper p-8 shadow-[var(--shadow-brutal-sm)]"
                >
                  <h3 className="text-lg font-extrabold text-ink">{block.title}</h3>
                  <ul className="mt-5 space-y-3 text-sm text-ink-soft">
                    {block.items.map((line) => (
                      <li key={line} className="flex gap-2">
                        <span className="font-bold text-accent" aria-hidden>
                          ·
                        </span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          className="scroll-mt-20 border-b-2 border-ink bg-paper"
        >
          <div className={`${SHELL} ${SECTION_Y}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted">
              Pricing
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
              Straightforward tiers
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-soft">
              Start small with trucks only, or bring authorities in from day one.
              Enterprise contracts bundle hosting, SLAs and integrations.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-md border-2 border-ink p-8 transition hover:-translate-y-0.5 ${
                    plan.featured
                      ? "bg-gradient-to-br from-accent to-accent-hover text-accent-ink shadow-[var(--shadow-brutal)] md:-translate-y-1 md:scale-[1.02]"
                      : "bg-paper shadow-[var(--shadow-brutal-sm)]"
                  }`}
                >
                  {plan.featured ? (
                    <span className="absolute -right-px -top-px rounded-bl-md border-2 border-ink bg-paper px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-ink">
                      Popular
                    </span>
                  ) : null}
                  <p
                    className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                      plan.featured ? "text-accent-ink/80" : "text-muted"
                    }`}
                  >
                    {plan.name}
                  </p>
                  <p className="mt-4 text-4xl font-extrabold tabular-nums leading-none">
                    {plan.price}
                    <span
                      className={`ml-1 text-sm font-semibold ${
                        plan.featured ? "text-accent-ink/85" : "text-muted"
                      }`}
                    >
                      {plan.unit}
                    </span>
                  </p>
                  <p
                    className={`mt-3 text-sm ${
                      plan.featured ? "text-accent-ink/90" : "text-ink-soft"
                    }`}
                  >
                    {plan.note}
                  </p>
                  <ul className="mt-8 flex-1 space-y-3 text-sm">
                    {plan.items.map((line) => (
                      <li key={line} className="flex gap-3">
                        <span
                          className={plan.featured ? "text-accent-warm" : "text-accent"}
                          aria-hidden
                        >
                          ✓
                        </span>
                        <span
                          className={
                            plan.featured ? "text-accent-ink/95" : "text-ink-soft"
                          }
                        >
                          {line}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="mailto:hello@transitiq.in?subject=TransitIQ%20—%20"
                    className={`mt-10 block rounded-md border-2 border-ink py-3 text-center text-xs font-extrabold uppercase tracking-wider no-underline transition duration-150 hover:-translate-y-0.5 active:translate-y-0 active:shadow-none ${
                      plan.featured
                        ? "bg-paper text-ink shadow-[var(--shadow-brutal-sm)] hover:bg-accent-soft hover:shadow-[var(--shadow-brutal)]"
                        : "bg-accent text-accent-ink shadow-[var(--shadow-brutal-sm)] hover:bg-accent-hover hover:shadow-[var(--shadow-brutal)]"
                    }`}
                  >
                    Contact
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="scroll-mt-20 border-b-2 border-ink bg-gradient-to-b from-paper-muted/40 to-paper"
        >
          <div className={`${SHELL} ${SECTION_Y}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-teal">
              FAQ
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
              Common questions
            </h2>
            <dl className="mt-10 space-y-6">
              {FAQ.map((item) => (
                <div
                  key={item.q}
                  className="rounded-md border-2 border-ink bg-paper p-6 shadow-[var(--shadow-brutal-sm)]"
                >
                  <dt className="font-extrabold text-ink">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-ink-soft">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Bottom CTA */}
        <section
          className="border-b-2 border-ink bg-ink text-paper"
          aria-label="Footer call to action"
        >
          <div
            className={`flex flex-col items-start justify-between gap-8 py-14 md:flex-row md:items-center ${SHELL}`}
          >
            <div className="flex max-w-xl gap-4">
              <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-md border-2 border-paper bg-accent sm:flex">
                <TruckLogo className="h-8 w-8 text-accent-ink" decorative />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-paper/55">
                  Next step
                </p>
                <p className="mt-1 text-xl font-extrabold tracking-tight md:text-2xl">
                  Share your lanes and fleet size — we&apos;ll map the rollout.
                </p>
              </div>
            </div>
            <a
              href="mailto:hello@transitiq.in"
              className="inline-flex rounded-md border-2 border-paper bg-accent px-6 py-3 text-xs font-extrabold uppercase tracking-wider text-accent-ink shadow-[var(--shadow-brutal-sm)] transition duration-150 hover:-translate-y-0.5 hover:bg-accent-hover active:translate-y-0 active:shadow-none"
            >
              Email hello@transitiq.in
            </a>
          </div>
        </section>
      </main>

      <footer className="bg-paper-muted/50">
        <div
          className={`flex flex-col gap-8 border-t-2 border-ink py-12 md:flex-row md:items-center md:justify-between ${SHELL}`}
        >
          <div className="flex items-center gap-3 text-sm font-extrabold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border-2 border-ink bg-accent">
              <TruckLogo className="h-6 w-6 text-accent-ink" decorative />
            </span>
            TransitIQ
          </div>
          <p className="text-sm text-ink-soft">© {new Date().getFullYear()} TransitIQ</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold">
            <a href="#offer" className="rounded px-1 text-ink no-underline transition hover:bg-accent-soft hover:text-accent">Product</a>
            <a href="#how" className="rounded px-1 text-ink no-underline transition hover:bg-accent-soft hover:text-accent">How it works</a>
            <a href="#pricing" className="rounded px-1 text-ink no-underline transition hover:bg-accent-soft hover:text-accent">Pricing</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
