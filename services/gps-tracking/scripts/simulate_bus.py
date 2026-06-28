"""
scripts/simulate_bus.py
───────────────────────
Pretend to be a bus's GPS device — moves a marker along a small path and posts
to the GPS service every few seconds. Lets you test live tracking without real
hardware.

Usage:
  python -m scripts.simulate_bus --route <transport_routes.id> \
      --url http://localhost:8100 --key <DEVICE_API_KEY> \
      --lat 28.6139 --lng 77.2090 --interval 3
"""

import argparse
import math
import time

import httpx


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--route", required=True, help="transport_routes.id (UUID)")
    ap.add_argument("--url", default="http://localhost:8100")
    ap.add_argument("--key", required=True, help="DEVICE_API_KEY from the service .env")
    ap.add_argument("--lat", type=float, default=28.6139, help="start latitude")
    ap.add_argument("--lng", type=float, default=77.2090, help="start longitude")
    ap.add_argument("--interval", type=float, default=3.0, help="seconds between pings")
    ap.add_argument("--steps", type=int, default=0, help="0 = run forever")
    args = ap.parse_args()

    lat, lng = args.lat, args.lng
    heading = 45.0  # NE
    endpoint = args.url.rstrip("/") + "/ping"
    headers = {"X-Device-Key": args.key}

    print(f"Simulating bus on route {args.route} -> {endpoint}\nCtrl+C to stop.\n")
    i = 0
    while args.steps == 0 or i < args.steps:
        # nudge ~0.0005 deg per step in the heading direction (~50m)
        rad = math.radians(heading)
        lat += 0.0005 * math.cos(rad)
        lng += 0.0005 * math.sin(rad)
        heading = (heading + 5) % 360  # gentle curve

        payload = {
            "route_id": args.route,
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
            "speed_kmh": round(25 + 10 * math.sin(i / 3), 1),
            "heading": round(heading, 1),
        }
        try:
            r = httpx.post(endpoint, json=payload, headers=headers, timeout=10)
            print(f"  [{i}] {r.status_code} lat={payload['latitude']} lng={payload['longitude']}")
        except Exception as e:  # noqa: BLE001
            print(f"  [{i}] ERROR: {e}")

        i += 1
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
