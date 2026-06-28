# GPS Tracking Service

A small **separate service** that receives bus GPS coordinates (from a device on
the bus or the driver's phone app) and writes them into the **shared SMS Supabase
database** (`bus_locations`). The web app reads the latest point per route — live
via Supabase Realtime.

> Requires migration `00033_bus_locations.sql` to be applied first.

```
bus device / driver app  ──POST /ping──▶  gps-tracking service  ──▶  Supabase
                          (X-Device-Key)                          bus_locations
                                                                       │ realtime
                                              Admin GpsTrackingPage  ◀──┘
                                              Parent ParentTransportPage
```

## Setup

```bash
cd services/gps-tracking
python -m venv venv
venv\Scripts\activate        # Windows  (or: source venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env          # fill SUPABASE_URL, SUPABASE_SERVICE_KEY, SCHOOL_ID, DEVICE_API_KEY
```

## Run

```bash
python main.py                # http://localhost:8100  (docs at /docs)
```

## Test without hardware (bus simulator)

Grab a `transport_routes.id` from the DB, then in another terminal:

```bash
python -m scripts.simulate_bus --route <transport_routes.id> \
    --key <DEVICE_API_KEY> --lat 28.6139 --lng 77.2090 --interval 3
```

It posts a moving location every few seconds. Check the `bus_locations` table /
`bus_latest_locations` view in Supabase to see it update.

## Device contract

`POST /ping` with header `X-Device-Key: <DEVICE_API_KEY>` and JSON:

```json
{ "route_id": "uuid", "latitude": 28.6139, "longitude": 77.2090,
  "speed_kmh": 28.5, "heading": 90 }
```

`speed_kmh`, `heading`, `recorded_at` are optional (`recorded_at` defaults to now, UTC).

## Security

`SUPABASE_SERVICE_KEY` bypasses RLS — keep it server-side. Give each deployment a
strong random `DEVICE_API_KEY`; rotate it if a device is lost.
