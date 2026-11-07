# TransitIQ schema diagrams

Open the markdown preview to render the pictures. Column lists stay in `database-schema.md`.

## The whole product

A company is a fleet. People, trucks, drivers, and shippers belong to that company. A trip ties one order, one truck, and one driver together. Roads are shared and sit outside the company. A trip meets the road when a driver reports an incident.

```mermaid
flowchart TB
  company[companies]
  user[fleet_users]
  vehicle[vehicles]
  driver[drivers]
  customer[customers]
  order[orders]
  trip[trips]

  company --> user
  company --> vehicle
  company --> driver
  company --> customer
  customer --> order
  order --> trip
  vehicle --> trip
  driver --> trip

  stops[trip_stops]
  gps[location_points]
  pod[proofs_of_delivery]
  bill[invoices and expenses]

  trip --> stops
  trip --> gps
  stops --> pod
  trip --> bill

  segment[road_segments]
  incident[incidents]
  ticket[repair_tickets]

  segment --> incident
  incident --> ticket
  driver -.-> incident
  gps -.-> segment
```

Solid arrows are ownership. Dotted arrows are where the fleet touches the road.

## 1. Company, people, access

The owner is a `fleet_users` row with the owner role. There is no separate owner table.

```mermaid
erDiagram
  companies ||--o{ branches : has
  companies ||--o{ fleet_users : has
  companies ||--o| subscriptions : billed_as
  companies ||--o{ api_keys : issues
  roles ||--o{ fleet_users : assigned
  roles ||--o{ role_permissions : grants
  permissions ||--o{ role_permissions : included
  fleet_users ||--o{ notification_preferences : chooses

  companies {
    uuid id PK
    text kind
    text name
    text plan
  }
  branches {
    uuid id PK
    uuid company_id FK
    text name
  }
  roles {
    uuid id PK
    text key
    text name
  }
  permissions {
    uuid id PK
    text key
  }
  role_permissions {
    uuid role_id PK
    uuid permission_id PK
  }
  fleet_users {
    uuid id PK
    uuid company_id FK
    uuid role_id FK
    text email
    text full_name
    text phone
    text address
  }
  subscriptions {
    uuid id PK
    uuid company_id FK
    text plan
    text status
  }
  api_keys {
    uuid id PK
    uuid company_id FK
    text key_hash
  }
  notification_preferences {
    uuid id PK
    uuid user_id FK
    text kind
    text channel
  }
```

`email_otps` is not linked to a user. A signup code exists before the person does.

```mermaid
erDiagram
  email_otps {
    uuid id PK
    text email
    text code_hash
    text purpose
    timestamptz expires_at
  }
```

## 2. Trucks and drivers

`fleet_users.driver_id` is set only when that login is a driver. A third-party owner is a `vendors` row, and their truck has `ownership = attached`.

```mermaid
erDiagram
  companies ||--o{ vehicles : owns
  companies ||--o{ drivers : employs
  companies ||--o{ vendors : hires
  vendors ||--o{ vehicles : attaches
  branches ||--o{ vehicles : parks
  branches ||--o{ drivers : based_at
  vehicles ||--o{ vehicle_documents : papers
  drivers ||--o{ driver_documents : papers
  vehicles ||--o{ devices : tracked_by
  drivers ||--o{ devices : phone
  fleet_users |o--o| drivers : login
  drivers ||--o{ driver_shifts : roster
  vehicles ||--o{ driver_shifts : assigned
  drivers ||--o{ driver_attendance : attendance
  drivers ||--o{ hos_logs : hours
  drivers ||--o{ driver_point_events : points

  vehicles {
    uuid id PK
    uuid company_id FK
    uuid vendor_id FK
    text registration_number
    text truck_type
    text ownership
    text status
  }
  drivers {
    uuid id PK
    uuid company_id FK
    text full_name
    text phone
    text pay_type
    date license_expires_on
  }
  vendors {
    uuid id PK
    uuid company_id FK
    text name
  }
  vehicle_documents {
    uuid id PK
    uuid vehicle_id FK
    text kind
    date expires_on
  }
  driver_documents {
    uuid id PK
    uuid driver_id FK
    text kind
    date expires_on
  }
  devices {
    uuid id PK
    uuid vehicle_id FK
    text kind
    text external_id
  }
```

## 3. Orders and trips

One trip is one order, one truck, and one driver. Stops are the pickups and drops. Proof of delivery hangs off a stop, not the trip.

```mermaid
erDiagram
  companies ||--o{ customers : serves
  customers ||--o{ orders : places
  orders ||--o{ trips : becomes
  vehicles ||--o{ trips : runs
  drivers ||--o{ trips : drives
  trips ||--o{ trip_stops : stops
  trip_stops ||--o| proofs_of_delivery : confirmed_by
  trips ||--o| lorry_receipts : lr
  trips ||--o{ tracking_links : public_link
  routes ||--o{ trips : planned_on
  fleet_users |o--o| customers : login

  customers {
    uuid id PK
    uuid company_id FK
    text name
  }
  orders {
    uuid id PK
    uuid customer_id FK
    text load_type
    text status
  }
  trips {
    uuid id PK
    uuid order_id FK
    uuid vehicle_id FK
    uuid driver_id FK
    text status
  }
  trip_stops {
    uuid id PK
    uuid trip_id FK
    int sequence
    text kind
  }
  proofs_of_delivery {
    uuid id PK
    uuid trip_stop_id FK
    text method
  }
  lorry_receipts {
    uuid id PK
    uuid trip_id FK
    text lr_number
    text eway_bill_number
  }
  tracking_links {
    uuid id PK
    uuid trip_id FK
    text token
  }
```

## 4. Live tracking

GPS points are the raw stream. A summary row is what remains after the raw points are deleted.

```mermaid
erDiagram
  vehicles ||--o{ location_points : emits
  trips ||--o{ location_points : during
  devices ||--o{ location_points : from
  trips ||--o| trip_summaries : summarised_as
  trips ||--o{ trip_stoppages : unplanned_stops
  geofences ||--o{ geofence_events : fires
  vehicles ||--o{ geofence_events : enters
  trips ||--o{ driving_events : overspeed_or_brake
  vehicles ||--o{ driving_events : from

  location_points {
    uuid id PK
    uuid vehicle_id FK
    uuid trip_id FK
    timestamptz recorded_at
    geography location
    text source
  }
  trip_summaries {
    uuid id PK
    uuid trip_id FK
    numeric distance_km
    numeric empty_km
  }
  geofences {
    uuid id PK
    uuid company_id FK
    text kind
    geography area
  }
  geofence_events {
    uuid id PK
    uuid geofence_id FK
    uuid vehicle_id FK
    text event
  }
  driving_events {
    uuid id PK
    uuid vehicle_id FK
    uuid trip_id FK
    text kind
  }
```

## 5. Maintenance

A work order is a repair on a truck. It is not a road repair.

```mermaid
erDiagram
  vehicles ||--o{ service_schedules : due
  vehicles ||--o{ work_orders : repaired
  workshops ||--o{ work_orders : does
  trips ||--o{ work_orders : broke_on
  work_orders ||--o{ work_order_parts : uses
  parts ||--o{ work_order_parts : drawn
  parts ||--o{ part_stock : stocked
  vehicles ||--o{ tyres : fitted
  tyres ||--o{ tyre_events : history
  vehicles ||--o{ vehicle_inspections : checked
  trips ||--o{ vehicle_inspections : pre_or_post
  vehicle_inspections ||--o{ vehicle_inspection_items : checklist

  work_orders {
    uuid id PK
    uuid vehicle_id FK
    uuid workshop_id FK
    text issue
    text status
  }
  service_schedules {
    uuid id PK
    uuid vehicle_id FK
    text name
    date next_due_on
  }
  tyres {
    uuid id PK
    uuid vehicle_id FK
    text position
    numeric km_run
  }
  vehicle_inspections {
    uuid id PK
    uuid vehicle_id FK
    uuid trip_id FK
    text kind
    boolean passed
  }
```

## 6. Fuel and money

The fleet's subscription (what they pay TransitIQ) is on `subscriptions` in diagram 1. The invoices here are bills the fleet sends to a shipper.

```mermaid
erDiagram
  vehicles ||--o{ fuel_entries : filled
  drivers ||--o{ fuel_entries : by
  trips ||--o{ fuel_entries : on
  fuel_stations ||--o{ fuel_entries : at
  fuel_stations ||--o{ fuel_prices : priced
  trips ||--o{ expenses : costs
  trips ||--o{ tolls : toll
  toll_plazas ||--o{ tolls : at
  drivers ||--o{ driver_ledger_entries : ledger
  customers ||--o{ invoices : billed
  invoices ||--o{ invoice_lines : lines
  trips ||--o{ invoice_lines : for
  invoices ||--o{ payments : paid
  vehicles ||--o{ challans : fined
  vendors ||--o{ vendor_payments : paid
  customers ||--o{ rate_cards : priced
  rate_cards ||--o{ quotations : quoted
  vehicles ||--o{ insurance_claims : claimed
  incidents ||--o{ insurance_claims : from

  fuel_entries {
    uuid id PK
    uuid vehicle_id FK
    uuid trip_id FK
    numeric litres
    numeric amount
  }
  expenses {
    uuid id PK
    uuid trip_id FK
    text category
    numeric amount
    text status
  }
  invoices {
    uuid id PK
    uuid customer_id FK
    text number
    text status
    numeric total
  }
  payments {
    uuid id PK
    uuid invoice_id FK
    numeric amount
  }
  driver_ledger_entries {
    uuid id PK
    uuid driver_id FK
    text kind
    numeric amount
  }
```

## 7. Roads, hazards, repair

These tables have no `company_id`, except a driver report, which records which fleet sent it. Many reports collapse into one incident. One repair ticket can close many incidents.

```mermaid
erDiagram
  junctions ||--o{ road_segments : ends
  road_segments ||--o{ road_conditions : history
  road_segments ||--o{ road_inspections : inspected
  road_inspections ||--o{ road_conditions : scored
  road_segments ||--o{ restrictions : limits
  road_segments ||--o{ incidents : on
  incidents ||--o{ incident_reports : merged_from
  drivers ||--o{ incident_reports : reports
  incidents ||--o{ black_spots : marks
  incidents ||--o{ repair_tickets : opens
  repair_tickets ||--o{ repair_ticket_incidents : fixes
  incidents ||--o{ repair_ticket_incidents : fixed_by
  contractors ||--o{ repair_tickets : assigned
  companies ||--|| contractors : profile
  repair_tickets ||--o{ ticket_updates : log
  repair_tickets ||--o{ ticket_photos : proof

  road_segments {
    uuid id PK
    text hierarchy
    text name
    numeric length_m
  }
  incidents {
    uuid id PK
    uuid road_segment_id FK
    text kind
    text status
    geography location
  }
  incident_reports {
    uuid id PK
    uuid incident_id FK
    uuid driver_id FK
    text source
  }
  repair_tickets {
    uuid id PK
    uuid incident_id FK
    uuid contractor_id FK
    text status
    int priority
  }
  contractors {
    uuid id PK
    uuid company_id FK
    numeric quality_rating
  }
```

Toll plazas and checkpoints are places on the map. They are not owned by a fleet. Trip toll charges point at a plaza from diagram 6.

```mermaid
erDiagram
  toll_plazas ||--o{ toll_plaza_rates : rates
  toll_plazas {
    uuid id PK
    text name
    geography location
  }
  toll_plaza_rates {
    uuid id PK
    uuid toll_plaza_id FK
    text truck_type
    numeric amount
  }
  checkpoints {
    uuid id PK
    text name
    text kind
    geography location
  }
```

## 8. Alerts and shared files

```mermaid
erDiagram
  incidents ||--o{ alerts : warns
  vehicles ||--o{ alerts : sent_to
  drivers ||--o{ alerts : sent_to
  trips ||--o{ sos_events : emergency
  drivers ||--o{ sos_events : raises
  fleet_users ||--o{ notifications : receives
  fleet_users ||--o{ comments : writes
  fleet_users ||--o{ audit_logs : did
  companies ||--o{ settings : config
  companies ||--o{ import_jobs : imports

  alerts {
    uuid id PK
    text kind
    text message
    uuid vehicle_id FK
  }
  sos_events {
    uuid id PK
    uuid driver_id FK
    uuid trip_id FK
    text status
  }
  notifications {
    uuid id PK
    uuid user_id FK
    text channel
    text kind
  }
  files {
    uuid id PK
    text owner_type
    uuid owner_id
    text file_key
  }
```

`files` has no foreign key. `owner_type` plus `owner_id` say which row the file belongs to.
