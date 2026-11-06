# Fleet Management and Road Safety System: End-to-End Product Guide

> Version 2.0 | Built with Next.js | Written from a product manager's view: features, cost, usability, and delivery

---

## Table of Contents

1. Introduction
2. Problem Statement
3. Motivation
4. Purpose and Vision
5. Overview and Structure
6. Product Thinking (Users, Journeys, Principles)
7. Part A: Fleet Management Features
8. Part B: Road Safety Features
9. Part C: Integration Features (Fleet + Road)
10. Part D: Additional Product Features (New)
11. Part E: Cross-Cutting Features
12. Usability and Experience Design
13. Cost Thinking and Business Model
14. System Architecture
15. Tech Stack
16. Data Model Overview
17. Project Structure
18. Delivery Roadmap and MVP Scope
19. Success Metrics (KPIs)
20. Risks and Mitigation
21. Testing, Deployment, and Operations
22. Final Thoughts

---

## 1. Introduction

This document describes a complete, end-to-end **Fleet Management System (FMS)** combined with a **Road Safety System (RSS)**. In this project, *fleet* means trucks and other heavy commercial vehicles.

- **FMS** answers: *Where are my trucks, who is driving, what does it cost, and what needs maintenance?*
- **RSS** answers: *Which roads are dangerous, what hazards exist right now, and how do we fix them?*
- **Combined**, they answer: *Which route is the safest and cheapest for this truck, right now?*

The product has three faces:

| Face | Used By | Device |
|------|---------|--------|
| Web dashboard | Fleet managers, dispatchers, road authorities, admins | Desktop and laptop |
| Driver app (PWA) | Drivers | Low-cost Android phones |
| Customer portal | Shippers and consignees | Any browser |

---

## 2. Problem Statement

- Fleet owners lose money through breakdowns, fuel leakage, late deliveries, empty return trips, and expired documents.
- Many small and mid-size fleets still use paper, phone calls, and Excel sheets.
- Drivers face potholes, accidents, closures, and waterlogging with no early warning.
- Road authorities learn about hazards late, and repair work is hard to track.
- Fleet data and road data live in separate places, so nobody connects "bad road" with "high repair cost."
- Existing tools are expensive, complex, and not built for low-network, low-literacy field use.

---

## 3. Motivation

- Heavy vehicles are involved in a large share of serious road accidents.
- Bad roads silently increase tyre wear, fuel use, and maintenance cost.
- Drivers see hazards first, but have no easy way to report them.
- Small fleet owners need a tool that is cheap, simple, and works in their language.
- One platform can save money for fleet owners and improve safety on the road.

---

## 4. Purpose and Vision

**Vision:** Every truck reaches its destination safely, on time, and at the lowest cost, and every road problem gets fixed faster.

**Goals**
- Give fleet managers full control over vehicles, drivers, trips, and money.
- Give drivers a very simple app for trips, alerts, expenses, and hazard reporting.
- Give road authorities a live view of road health, incidents, and repairs.
- Use shared data to plan safer and cheaper routes.
- Keep the product affordable and easy enough for a fleet of 5 trucks to adopt in one day.

**Non-goals (for now)**
- No AI or ML features. All logic is rule-based, explainable, and easy to debug.
- No load marketplace in the first release.
- No native mobile apps in the first release (PWA first).

---

## 5. Overview and Structure

| Part | Name | Focus |
|------|------|-------|
| A | Fleet Management | Vehicles, drivers, trips, cost |
| B | Road Safety | Road data, hazards, incidents, repairs |
| C | Integration | Where fleet and road data meet |
| D | Additional Features | Extra features that make the product complete |
| E | Cross-Cutting | Roles, real-time, offline, security |
| F | Product and Tech | UX, cost, architecture, stack, roadmap |

---

## 6. Product Thinking

### 6.1 User Personas

| Persona | Goal | Main Pain Point |
|---------|------|-----------------|
| **Owner** (fleet of 5 to 50 trucks) | Know profit per truck and avoid losses | No visibility, fuel theft, expired papers |
| **Fleet Manager / Dispatcher** | Assign trips and keep trucks moving | Constant phone calls, no live status |
| **Driver** | Finish trips, get paid, stay safe | Weak network, complex apps, language barrier |
| **Mechanic / Workshop Lead** | Keep trucks running | No service history, missing parts |
| **Road Authority Officer** | Fix roads fast and prove progress | Late reports, no tracking of contractors |
| **Contractor** | Get repair tickets and close them | Unclear instructions, payment delays |
| **Customer (shipper)** | Know where the goods are | No tracking, no proof of delivery |

### 6.2 Core User Journeys

1. **Owner onboarding:** sign up, import vehicles by CSV, add drivers, see the first live truck on the map within one day.
2. **Dispatch:** create order, pick truck and driver, share trip with the driver, share the tracking link with the customer.
3. **Driver day:** open app, see today's trip, start trip, get hazard alerts, add expenses, upload proof of delivery, end trip.
4. **Hazard to fix:** driver reports a pothole, others confirm it, the authority creates a ticket, the contractor repairs it, the authority verifies it, and the hazard disappears from the map.
5. **Compliance:** system sends expiry reminders, and the manager uploads the renewed document.

### 6.3 Product Principles

- **Simple first:** every screen should be usable without training.
- **Driver-first design:** large buttons, few words, icons, and local languages.
- **Works offline:** the field is not a good place for a loading spinner.
- **Cost-aware:** use open-source tools and cheap infrastructure where possible.
- **Explainable rules:** every alert must show why it was triggered.
- **Data ownership:** customers can export all their data at any time.

---

# PART A: Fleet Management Features

## A1. Vehicle Registry
- **Vehicle profile:** registration number, make, model, year, chassis number, and engine number.
- **Type and capacity:** truck type (open, closed, trailer, tanker, container), load capacity, axle count, and dimensions.
- **Ownership:** owned, leased, or attached (third-party), with contract dates.
- **Status:** active, on trip, idle, under maintenance, or retired.
- **Document storage:** upload RC, insurance, permit, and fitness copies against each vehicle.
- **Bulk import:** add many vehicles through a CSV or Excel file.

## A2. Driver Management
- **Profile:** name, contact, address, photo, and emergency contact.
- **License tracking:** license number, class, expiry date, and endorsements.
- **Hours of service:** record driving hours and rest hours to reduce fatigue.
- **Shift and roster:** assign drivers to shifts and vehicles.
- **Performance score:** rule-based score from overspeed, harsh braking, idle time, and on-time delivery.
- **Attendance and leave:** track availability for planning.
- **Driver history:** trips, incidents, complaints, and training.
- **Driver ledger:** advances, expenses, deductions, and pending pay in one place.

## A3. Live Vehicle Tracking
- **Real-time location:** position on a map, updated every few seconds.
- **Vehicle state:** speed, heading, ignition status, and idle time.
- **Geofencing:** draw zones (depots, customer sites, restricted areas) and alert on entry or exit.
- **Trip replay:** play back the exact path of any past trip.
- **Stoppage detection:** flag long or unplanned stops.
- **Device health:** alert when a GPS device goes offline or loses power.
- **Two tracking sources:** dedicated GPS device or the driver's phone (lower cost option).

## A4. Trips and Dispatch
- **Order management:** pickup, drop, load type, weight, and deadline.
- **Assignment:** match orders with available, suitable trucks and drivers.
- **Route and ETA:** planned route and live ETA that updates on the way.
- **Trip lifecycle:** created, assigned, started, loading, in transit, unloading, completed, closed.
- **Proof of delivery (POD):** signature, photo, or OTP confirmation at drop.
- **Delay alerts:** notify when a trip falls behind schedule.
- **Multi-stop trips and return loads:** support several drops and backhaul planning.
- **Auto status by geofence:** trip moves to "arrived" when the truck enters the drop zone.

## A5. Maintenance Management
- **Service schedules:** reminders by kilometres, engine hours, or date.
- **Preventive maintenance:** checklists for oil, brakes, filters, and fluids.
- **Breakdown log:** issue, location, downtime, and repair cost.
- **Work orders:** create, assign, and close repair jobs with parts and labour.
- **Spare parts inventory:** stock levels, usage, and reorder alerts.
- **Tyre management:** position, brand, fitted date, kilometres run, rotation, retreading, and cost per km.
- **Pre-trip and post-trip inspection:** digital driver checklist with photos.
- **Vendor and workshop directory:** preferred mechanics with contact and rating.

## A6. Fuel Management
- **Fuel entries:** date, litres, price, station, odometer reading, and receipt photo.
- **Mileage tracking:** kilometres per litre by vehicle, trip, and driver.
- **Anomaly rules:** flag a fuel drop while parked, mileage far below average, or a fill above tank capacity.
- **Fuel cost reports:** by vehicle, route, and period.
- **Fuel price log:** track price changes to find cheaper stations on regular routes.

## A7. Compliance and Documents
- **Expiry tracking:** insurance, permit, fitness certificate, pollution certificate, road tax, and driver license.
- **Reminders:** alerts at 30, 15, and 7 days before expiry.
- **Document vault:** central and searchable storage for all papers.
- **Compliance dashboard:** shows which vehicles and drivers are fully compliant.
- **Block rule:** do not allow a trip assignment if the vehicle or driver has an expired document.
- **Challan and fine tracking:** record traffic fines against vehicle and driver, with payment status.

## A8. Finance and Billing
- **Trip costing:** fuel, toll, driver pay, maintenance share, and other expenses per trip.
- **Toll and FASTag expense:** record and match toll charges to trips.
- **Driver pay:** per-trip, per-kilometre, or salary-based, with advances and deductions.
- **Invoicing:** generate customer invoices from completed trips, with GST fields.
- **Payment tracking:** paid, pending, and overdue invoices with reminders.
- **Profit view:** profit and loss per vehicle, route, driver, and customer.
- **Expense approval:** manager approves or rejects driver-submitted expenses.

---

# PART B: Road Safety Features

## B1. Road Network Data
- **Road hierarchy:** highways, state roads, district roads, and city roads.
- **Segments and junctions:** each road split into segments with start and end points.
- **Attributes:** length, lanes, surface type, speed limit, and owning authority.
- **Map layer:** all data on a GIS map with zoom, layers, and filters.
- **Data import:** load road data from open map sources, then enrich it with your own records.

## B2. Road Condition Monitoring
- **Condition record:** surface quality, potholes, cracks, and edge damage per segment.
- **Inspection records:** date, inspector, photos, and rating.
- **Condition score:** simple rule-based score (good, fair, poor, critical) per segment.
- **History:** how a segment's condition changed over time.
- **Inspection checklist:** mobile-friendly form for field officers.

## B3. Hazard and Incident Management
- **Incident types:** accident, breakdown, closure, diversion, waterlogging, landslide, fog, and animal crossing.
- **Incident record:** location, time, severity, photos, and status.
- **Lifecycle:** reported, verified, in progress, resolved.
- **Live incident map:** active incidents visible to all permitted users.
- **Verification rule:** an incident becomes "confirmed" after several independent reports or authority approval.
- **Auto-expiry:** temporary hazards close automatically after a set time unless renewed.
- **Duplicate merge:** reports of the same hazard within a small radius are grouped together.

## B4. Road Restrictions and Rules
- **Physical limits:** height, weight, width, and axle load limits.
- **Time rules:** night-entry bans, peak-hour restrictions, and festival closures.
- **Traffic rules:** one-way roads, no-entry zones, and speed zones.
- **Hazardous goods rules:** restricted routes for tankers and dangerous cargo.

## B5. Toll Plazas and Checkpoints
- **Toll plaza data:** location, rates by vehicle class, and operating hours.
- **Checkpoints:** weigh stations, police checkpoints, and border posts.
- **Toll estimate:** expected toll for any route and vehicle class.

## B6. Accident Black Spot Analysis
- **Black spot map:** stretches with repeated accidents.
- **Accident data:** cause, time, vehicles involved, and severity.
- **Hotspot rule:** mark a location as a black spot after N accidents within a set radius and period.
- **Trend reports:** accidents by time of day, road type, and season.

## B7. Road Maintenance and Repair
- **Repair tickets:** created from inspections or driver reports.
- **Assignment:** assign tickets to contractors or road teams.
- **Status tracking:** open, assigned, in progress, completed, verified.
- **Deadlines and SLA:** alerts for overdue repairs.
- **Contractor records:** work done, cost, and quality rating.
- **Before and after photos** as proof of completion.
- **Repair priority rule:** rank tickets by severity, traffic load, and accident history.

## B8. Public Safety Alerts
- **Hazard alerts:** warn drivers about danger ahead.
- **Weather alerts:** rain, fog, and flood warnings for a route.
- **Broadcast:** the authority can send an alert to all vehicles in an area.

---

# PART C: Integration Features (Fleet + Road)

This is the real value of the combined system.

## C1. Safe and Smart Route Planning
- Avoid closed roads and active hazards.
- Respect height, weight, and time restrictions for the specific truck.
- Compare routes by distance, time, toll cost, and road condition.
- Prefer routes that avoid black spots.
- Show a clear reason for the chosen route ("Avoided closure at KM 42").

## C2. Driver Hazard Reporting
- Report a pothole, accident, or blockage in two taps (photo plus automatic location).
- A report becomes an incident or repair ticket automatically.
- Works offline and syncs later.
- Reward verified reports with points that unlock small incentives.

## C3. Live Alerts to Trucks
- Alert the driver when a hazard, closure, or black spot is ahead.
- Alert when the truck enters a restricted zone or breaks a speed limit.
- Short, voice-friendly messages so the driver stays focused.

## C4. Road Quality versus Vehicle Cost
- Link road condition with tyre wear, breakdowns, and maintenance cost.
- Show which roads cost the fleet the most.
- Give authorities evidence to prioritise repairs.

## C5. Route and Segment Analytics
- Average speed and delay per road segment.
- Most expensive routes by fuel, toll, and repair cost.
- Harsh braking and overspeed events plotted on the map to find unsafe spots.

## C6. Emergency Response
- SOS button for the driver with live location sharing.
- Automatic alert to the fleet manager and emergency contacts.
- Nearest hospital, police station, and mechanic lookup.

---

# PART D: Additional Product Features (New)

These features make the product feel complete and give real business value.

## D1. Customer Tracking Portal
- Shareable tracking link for each shipment (no login needed).
- Live ETA, status timeline, and proof of delivery download.
- Optional branded page with the transporter's logo.

## D2. Lorry Receipt (LR) and E-Way Bill Support
- Generate lorry receipts (consignment notes) from trip data.
- Store e-way bill numbers, validity dates, and expiry alerts.
- Print-ready and PDF formats.

## D3. Detention and Waiting Time Tracking
- Record the time a truck waits at loading and unloading points using geofences.
- Calculate detention charges for the customer automatically.

## D4. Empty Run and Utilisation Analysis
- Track empty kilometres and idle days per vehicle.
- Suggest return load matching through simple rules (nearby pending orders).

## D5. Vendor and Attached Truck Management
- Manage third-party trucks and owners.
- Track vendor payments, advances, and trip history.

## D6. Insurance and Claims
- Record accidents with photos, location, and documents.
- Track claim status and settlement amount.

## D7. Driver Incentive and Safety Program
- Monthly safety leaderboard based on overspeed, harsh braking, and hazard reports.
- Points, badges, and optional cash incentives.

## D8. Quotation and Rate Cards
- Rate cards per route, vehicle type, and customer.
- Quick quotation generator with toll and fuel estimate.

## D9. Citizen Road Reporting (Public Map)
- Anyone can report a road problem through a simple web form.
- Public map of verified hazards and repair progress.
- Builds trust and gives the road side its own audience.

## D10. Communication Tools
- In-app notes and comments on trips and tickets.
- WhatsApp or SMS share links for trips and tracking.
- One-tap call to driver or manager.

## D11. Multi-Language and Accessibility
- English and Hindi first, with a simple way to add more languages.
- Large text mode, high-contrast mode, and icon-led screens for the driver app.

## D12. Data Import, Export, and Public API
- CSV and Excel import for vehicles, drivers, and past trips.
- One-click export of all data.
- Public API keys and webhooks for integrations.

---

# PART E: Cross-Cutting Features

## E1. Roles and Permissions

| Role | Main Access |
|------|-------------|
| Super Admin | Everything, settings, billing, users |
| Owner | All fleet data and finance of their company |
| Fleet Manager | Vehicles, drivers, trips, maintenance |
| Dispatcher | Orders, assignments, tracking |
| Accountant | Invoices, expenses, driver pay |
| Driver | Own trips, alerts, expenses, hazard reports |
| Mechanic | Work orders, parts |
| Road Authority | Road data, incidents, repair tickets |
| Contractor | Assigned repair tickets only |
| Customer | Own shipments and invoices |

## E2. Real-Time Pipeline
- GPS ingestion from devices and phones.
- Queue to absorb bursts of location updates.
- WebSockets to push live updates to dashboards and apps.
- Batching and throttling to save bandwidth and cost.

## E3. Offline Mode
- Driver app stores trips, checklists, expenses, and hazard reports locally.
- Automatic sync when the network returns.
- Conflict handling so no data is lost or duplicated.

## E4. Notifications
- Channels: push, SMS, email, and in-app.
- Triggers: expiry reminders, delays, hazards, repair deadlines, and payment dues.
- User preferences to control which alerts each person receives.
- SMS used only for critical alerts to control cost.

## E5. Reports and Dashboards
- **Fleet:** utilisation, cost per km, on-time rate, idle time, fuel efficiency, profit per truck.
- **Road:** road health summary, open tickets, repair turnaround, black spot count.
- **Combined:** cost impact of bad roads, safest routes, incident trends.
- Export to PDF, Excel, and CSV.
- Scheduled email reports (daily and weekly).

## E6. Security and Audit
- Strong password rules and optional two-factor authentication.
- Role-based access control on every action.
- Audit log of who changed what and when.
- Encryption in transit and at rest.
- Regular backups with tested restore.
- Data retention rules for location data.
- Privacy controls aligned with applicable data protection law.

## E7. Admin and Settings
- Configurable thresholds (speed limit, idle time, black spot rule).
- Master data: vehicle types, incident types, expense categories.
- Multi-branch and multi-company (multi-tenant) support.
- Company branding and invoice templates.

---

# PART F: Product and Technology

## 12. Usability and Experience Design

### Driver App (most important to get right)
- One main screen: **Today's trip**, with one primary button.
- Big touch targets, minimum text, and clear icons.
- Hindi and English with a language switch on the first screen.
- Works on low-end Android phones and 2G or 3G networks.
- Battery-friendly tracking (adaptive update interval when stopped).
- Voice alerts for hazards so the driver does not need to look at the screen.
- Photo upload with automatic compression.
- Sign in with phone number and OTP (no complex passwords).

### Manager Dashboard
- Map-first home screen with filters (moving, idle, stopped, offline).
- Alert center with clear priority (critical, warning, info).
- Every table has search, filters, and export.
- Keyboard shortcuts and bulk actions for power users.
- Dark mode and responsive layout for tablets.

### Authority Console
- Map plus ticket board (Kanban) view.
- Heat layers for potholes, incidents, and black spots.
- One-click ticket assignment to contractors.

### General UX Rules
- First useful result within five minutes of sign-up.
- Empty states that explain what to do next.
- Undo for destructive actions where possible.
- Plain language in all alerts.

---

## 13. Cost Thinking and Business Model

### Where the Money Goes

| Cost Area | Biggest Driver | How to Control It |
|-----------|----------------|-------------------|
| Maps and routing | Map tiles and route requests | Use open-source maps and self-hosted routing |
| GPS data storage | Millions of location points | Time-series storage, compression, retention rules |
| SMS | Per-message charges | Push first, SMS only for critical alerts |
| Hosting | Servers and database | Start on a single VPS, scale only when needed |
| File storage | Photos and documents | Compress images, use object storage with lifecycle rules |
| GPS hardware | Device cost per truck | Offer phone-based tracking as a free or cheap option |
| Support | Onboarding time | Self-serve onboarding, CSV import, in-app guides |

### Rough Cost Plan (estimates only; verify current prices)

| Stage | Scale | Infrastructure |
|-------|-------|----------------|
| MVP and pilot | Up to 50 trucks | One VPS, managed or self-hosted database, object storage |
| Early growth | 50 to 500 trucks | Separate app, database, and real-time servers, Redis, backups |
| Scale | 500+ trucks | Read replicas, queue workers, CDN, monitoring |

### Data Retention Plan (cost control)
- Raw GPS points: keep 90 days at full detail.
- Older data: downsample to one point per minute, then to trip summaries.
- Photos: compress on upload and archive after a set period.

### Pricing Model Options
- **Per vehicle per month:** simple and easy to explain (recommended).
- **Free tier:** up to 3 vehicles, basic features, to drive adoption.
- **Pro tier:** unlimited reports, API, geofences, and advanced alerts.
- **Authority plan:** flat fee per region for the road safety console.
- **Add-ons:** SMS packs, GPS devices, and custom integrations.

### Cost-Saving Product Decisions
- Phone-based tracking first, device-based tracking as an upgrade.
- PWA instead of native apps in the first release (one codebase, no store fees).
- Open-source maps, routing, and geocoding.
- Rule-based logic instead of paid analytics tools.

---

## 14. System Architecture

### High-Level View

```
Driver PWA        Manager Dashboard        Authority Console        Customer Portal
      \                  |                        |                       /
       \                 |                        |                      /
                    Next.js App (UI + API Routes / Server Actions)
                                   |
                +------------------+------------------+
                |                                     |
        PostgreSQL + PostGIS                   Redis (cache, queues)
        (TimescaleDB for locations)                    |
                |                              Background Workers
                |                  (alerts, reports, reminders, notifications)
                |
        Object Storage (photos, documents)

GPS Devices / Phones ---> Ingestion Service ---> Queue ---> Database
                                   |
                          Realtime Service (WebSocket) ---> Dashboards and Apps
```

### Why This Shape
- **Next.js** handles UI, server rendering, and standard APIs in one codebase.
- **A separate ingestion service** keeps heavy GPS traffic away from the web app.
- **A separate real-time service** is used because long-lived WebSocket connections do not fit serverless hosting well.
- **Workers** run scheduled and heavy jobs (reminders, reports) without slowing the user.
- **PostGIS** handles all spatial queries (nearby hazards, route buffers, geofences).

### Key Flows
1. **Location update:** device sends point, ingestion validates it, queue buffers it, worker writes it in batches, real-time service pushes it to viewers.
2. **Hazard report:** driver submits (offline safe), API stores it, verification rules run, nearby trucks receive alerts.
3. **Reminder:** scheduled job finds documents expiring soon, creates notifications, and sends them on the chosen channels.

---

## 15. Tech Stack

### Frontend
| Need | Choice | Reason |
|------|--------|--------|
| Framework | **Next.js** (App Router) with **TypeScript** | One codebase for UI and API, strong ecosystem |
| Styling | **Tailwind CSS** | Fast and consistent |
| UI components | **shadcn/ui** (Radix based) | Accessible, customisable, free |
| Data fetching | **TanStack Query** | Caching, retries, offline friendliness |
| Client state | **Zustand** | Small and simple |
| Forms and validation | **React Hook Form** + **Zod** | Shared validation on client and server |
| Maps | **MapLibre GL JS** with OpenStreetMap-based tiles | No per-request map fee |
| Charts | **Recharts** or **Apache ECharts** | Dashboards and reports |
| Tables | **TanStack Table** | Large data tables with filters |
| Internationalisation | **next-intl** | English and Hindi support |
| PWA and offline | **Serwist** (service worker) + **Dexie** (IndexedDB) + Background Sync | Offline driver app |

### Backend
| Need | Choice | Reason |
|------|--------|--------|
| API layer | Next.js Route Handlers and Server Actions | Less moving parts |
| Optional typed API | **tRPC** | End-to-end type safety |
| Real-time service | **Node.js** with **Fastify** and **ws** (or Socket.IO) | Persistent WebSocket connections |
| GPS ingestion | Small **Node.js** service (HTTP and TCP listeners) | Supports devices and phones |
| Background jobs | **BullMQ** on Redis | Retries, schedules, and rate limits |
| Authentication | **Auth.js** or **Better Auth** with phone OTP | Flexible login methods |
| Authorization | Role-based checks with a central policy file | Clear and testable |
| Validation | **Zod** | Single source of truth for data shapes |
| File uploads | Pre-signed URLs to object storage | Keeps large files off the server |

### Data
| Need | Choice | Reason |
|------|--------|--------|
| Primary database | **PostgreSQL** | Reliable and relational |
| Spatial data | **PostGIS** | Geofences, nearby search, route buffers |
| Time-series locations | **TimescaleDB** extension (or partitioned tables) | Fast inserts and cheap compression |
| ORM | **Drizzle ORM** (or Prisma with raw SQL for spatial) | Type safety with SQL control |
| Cache and queues | **Redis** | Live state, rate limits, job queue |
| Object storage | **S3-compatible** (Cloudflare R2, MinIO, or AWS S3) | Photos and documents |
| Search | PostgreSQL full-text search | No extra service needed at first |

### Maps and Routing
| Need | Choice | Reason |
|------|--------|--------|
| Base map data | **OpenStreetMap** | Free and open |
| Routing engine | **OSRM**, **Valhalla**, or **GraphHopper** (self-hosted) | Truck profiles and custom restrictions |
| Geocoding | **Nominatim** (self-hosted) or a paid API for early stages | Address to coordinates |
| Spatial maths | **Turf.js** on client, PostGIS on server | Distance, buffers, polygons |

### Notifications and Communication
| Need | Choice |
|------|--------|
| Push | Web Push (VAPID) |
| SMS | An Indian SMS provider such as MSG91 or similar |
| Email | Resend or Amazon SES |
| WhatsApp | Optional later through an approved provider |

### DevOps and Quality
| Need | Choice |
|------|--------|
| Monorepo | **pnpm** workspaces with **Turborepo** |
| Containers | **Docker** and **Docker Compose** |
| Hosting (start) | One VPS with Nginx or Caddy as reverse proxy |
| Hosting (grow) | Separate servers for web, realtime, workers, and database |
| CI/CD | **GitHub Actions** |
| Unit and integration tests | **Vitest** |
| End-to-end tests | **Playwright** |
| Error tracking | **Sentry** |
| Logs and metrics | **Prometheus** and **Grafana** (or a hosted free tier) |
| Backups | Scheduled database dumps to object storage, with restore drills |
| Code quality | ESLint, Prettier, and TypeScript strict mode |

### Hardware and Integrations
- GPS devices that support standard TCP or HTTP protocols.
- Driver phone as a tracker through the PWA (foreground and background where allowed).
- FASTag, toll, and vehicle data integrations through available APIs.
- Payment gateway for subscriptions (such as Razorpay).

---

## 16. Data Model Overview

**Core entities**

| Group | Entities |
|-------|----------|
| Tenancy and access | Company, Branch, User, Role, Permission, ApiKey |
| Fleet | Vehicle, VehicleDocument, Driver, DriverDocument, Device |
| Operations | Customer, Order, Trip, TripStop, Route, ProofOfDelivery, LorryReceipt |
| Tracking | LocationPoint, Geofence, GeofenceEvent, TripSummary |
| Maintenance | ServiceSchedule, WorkOrder, Part, PartStock, Tyre, TyreEvent, Inspection |
| Fuel and finance | FuelEntry, Expense, Toll, Invoice, Payment, DriverLedger, Challan |
| Road | RoadSegment, Junction, RoadCondition, Inspection, Restriction, TollPlaza, Checkpoint |
| Safety | Incident, IncidentReport, BlackSpot, Alert, SosEvent |
| Repair | RepairTicket, Contractor, TicketUpdate, TicketPhoto |
| System | Notification, AuditLog, Setting, ImportJob |

**Important relationships**
- Company has many Vehicles, Drivers, Customers, and Users (multi-tenant isolation on every table).
- Trip links one Order, one Vehicle, one Driver, and many Stops and LocationPoints.
- IncidentReport (many) merge into one Incident (spatially grouped).
- Incident can create a RepairTicket, and a ticket can fix many incidents.
- RoadSegment has many Conditions, Restrictions, Incidents, and Tickets.

**Database design notes**
- Store all geometry in PostGIS with spatial indexes.
- Partition LocationPoint by time.
- Add `company_id` to every tenant table, and enforce it in every query.
- Use soft delete for business records and audit every change.

---

## 17. Project Structure

```
fleet-road-platform/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── fleet/
│   │   │   │   ├── trips/
│   │   │   │   ├── tracking/
│   │   │   │   ├── maintenance/
│   │   │   │   ├── finance/
│   │   │   │   ├── roads/
│   │   │   │   ├── incidents/
│   │   │   │   ├── tickets/
│   │   │   │   └── reports/
│   │   │   ├── driver/
│   │   │   ├── track/[token]/
│   │   │   ├── report/
│   │   │   └── api/
│   │   ├── components/
│   │   ├── lib/
│   │   └── messages/
│   ├── realtime/
│   ├── ingestion/
│   └── worker/
├── packages/
│   ├── db/
│   ├── validation/
│   ├── rules/
│   ├── ui/
│   └── config/
├── infra/
│   ├── docker/
│   └── nginx/
└── docs/
```

**Why `packages/rules`:** all alert and safety rules (overspeed, black spot, geofence, expiry) live in one tested package, shared by the web app, workers, and real-time service.

---

## 18. Delivery Roadmap and MVP Scope

### MVP Definition
The smallest product that a real fleet owner would pay for:
- Vehicles, drivers, trips, and live tracking.
- Driver PWA with trip flow and proof of delivery.
- Document expiry reminders.
- Basic trip costing and fuel entries.
- Hazard reporting by drivers with a simple map.

### Phases

| Phase | Duration (estimate) | Scope | Outcome |
|-------|---------------------|-------|---------|
| 0 | 1 week | Product scope, UX wireframes, schema draft, repo and CI setup | Clear plan and base project |
| 1 | 3 to 4 weeks | Auth, multi-tenancy, roles, vehicles, drivers, trips | Working fleet core |
| 2 | 3 weeks | GPS ingestion, live map, geofences, trip replay | Real-time visibility |
| 3 | 3 weeks | Driver PWA with offline mode, POD, expenses | Field-ready driver app |
| 4 | 3 weeks | Maintenance, fuel, compliance, reminders | Cost control |
| 5 | 3 weeks | Road network, incidents, repair tickets, authority console | Road safety system |
| 6 | 2 to 3 weeks | Hazard reporting, live alerts, black spots | Fleet and road connected |
| 7 | 3 weeks | Smart routing with restrictions, route analytics | Full combined value |
| 8 | 3 weeks | Finance, invoicing, customer portal, LR, e-way bill fields | Complete business loop |
| 9 | 2 weeks | Reports, notifications polish, hardening, backups, load tests | Production-ready |
| 10 | Ongoing | Pilot with 2 or 3 real fleets, feedback, pricing tests | Market fit |

**Rule:** each phase must end with something usable and demonstrable.

### MoSCoW Prioritisation

| Priority | Features |
|----------|----------|
| **Must have** | Vehicles, drivers, trips, live tracking, driver PWA, document reminders, incidents, repair tickets |
| **Should have** | Maintenance, fuel anomaly rules, trip costing, smart routing, customer tracking link |
| **Could have** | Invoicing, LR and e-way bill, incentives, citizen reporting, quotations |
| **Won't have (now)** | Load marketplace, native apps, AI features, in-house GPS hardware |

---

## 19. Success Metrics (KPIs)

**Product and growth**
- Time from sign-up to first live truck on the map (target: under one day).
- Weekly active fleets and drivers.
- Driver app daily usage rate.
- Free to paid conversion rate.
- Monthly churn.

**Fleet value**
- Reduction in fuel cost per km.
- Reduction in document expiry misses (target: zero).
- Increase in vehicle utilisation.
- Reduction in empty kilometres.
- On-time delivery rate.

**Road safety value**
- Hazards reported per week and percentage verified.
- Average time from report to repair.
- Reduction in incidents at repaired black spots.
- Alert delivery time (target: a few seconds).

**Technical health**
- Location update latency.
- Uptime.
- Offline sync success rate.
- Cost per tracked vehicle per month.

---

## 20. Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Weak network in the field | Lost data, bad experience | Offline-first PWA with queued sync |
| Phone GPS drains battery or stops in background | Missing tracking | Adaptive intervals, clear driver guidance, device option |
| Large location data volume | High storage and query cost | Time-series storage, retention and downsampling |
| False hazard reports | Loss of trust | Multi-report verification, reporter reputation, authority review |
| Driver reluctance to be tracked | Low adoption | Focus on driver benefits: faster pay, safety, fair scoring |
| Authority data access | Slow road-side adoption | Start with community reports and open map data |
| Cost overrun from third-party APIs | Margin loss | Open-source maps and routing, SMS only for critical alerts |
| Data privacy concerns | Legal and trust issues | Consent, role-based access, retention limits, export and delete tools |
| Scope creep | Delayed launch | MoSCoW list and strict phase goals |
| Single server failure | Downtime | Backups, health checks, and a documented recovery plan |
| WebSocket scaling | Dropped live updates | Dedicated real-time service with Redis pub/sub |

---

## 21. Testing, Deployment, and Operations

**Testing**
- Unit tests for every rule in `packages/rules`.
- Integration tests for API and database queries (including spatial queries).
- End-to-end tests for core journeys: dispatch, driver trip, hazard to repair.
- Simulated GPS data generator to test live tracking and load.
- Offline tests: turn the network off in Playwright and verify sync.

**Deployment**
- Docker images for each service, built in CI.
- Staging and production environments.
- Database migrations run automatically and are reversible.
- Feature flags for risky or unfinished features.

**Operations**
- Health checks and uptime alerts.
- Error tracking and structured logs.
- Daily backups and monthly restore tests.
- Simple admin tools for support (view company data, replay a trip, resend a notification).

---

## 22. Final Thoughts

### What Makes This Project Strong
- **It solves two connected problems.** Fleet cost and road safety feed each other, and that link is hard for competitors to copy.
- **It is a full product, not only a demo.** It covers real roles, real money flows, real field conditions, and a clear way to earn revenue.
- **It shows deep engineering skill.** Real-time pipelines, geospatial queries, offline-first design, multi-tenancy, queues, and observability all appear in one project.
- **It stays explainable.** Every alert and score comes from a clear rule, which builds trust with users and makes debugging simple.

### The Product Manager's Checklist
- **Cost:** Open-source maps, routing, and a single VPS at the start keep the cost per truck very low. Data retention rules protect the margin as data grows.
- **Usability:** The driver app decides whether the product succeeds. If drivers do not use it, the data never arrives. Keep it simple, local-language, and offline-ready.
- **Adoption:** A fleet owner should see value on day one. CSV import, phone-based tracking, and a free tier remove the biggest barriers.
- **Trust:** Explain every alert, verify hazard reports, and give users control of their data.
- **Focus:** Ship the MVP first. A small product that works beats a large product that is half finished.

### Biggest Technical Challenges
1. **Real-time scale:** thousands of location updates per minute need a queue, batching, and efficient storage.
2. **Spatial performance:** "what hazards are near this route?" needs spatial indexes and careful queries.
3. **Offline sync:** conflict handling must be designed from the start, not added later.
4. **Multi-tenancy:** a single missing `company_id` filter is a serious data leak, so enforce it centrally and test it.
5. **Map and routing cost:** self-hosting saves money but adds operations work, so plan time for it.

### How to Stay on Track
- Build the core first (auth, vehicles, drivers, trips), then add one module at a time.
- Keep the fleet module and the road module separate in code, and connect them through events and clear APIs.
- Put all safety and alert logic in one shared, well-tested rules package.
- Create realistic demo data early, so every phase can be demonstrated and tested.
- Talk to real fleet owners and drivers during the pilot, and change the product based on what they say.

### Immediate Next Steps
1. Finalise the MVP scope and wireframes for the driver app and the live map.
2. Design the database schema (start with Company, User, Vehicle, Driver, Trip, LocationPoint, Incident).
3. Set up the monorepo, CI, Docker Compose (PostgreSQL with PostGIS, Redis), and the Next.js base app.
4. Build Phase 1, then run a GPS simulator for Phase 2.
5. Find two or three small fleets for an early pilot.

### Closing Note
The goal is not to add every feature. The goal is to build a reliable core, make it delightful for drivers and managers, keep the cost per truck low, and then connect the fleet world with the road world in a clean way. If each phase is finished well, the final product will be both technically impressive and genuinely useful in the real world.