"""
scripts/recognize_webcam.py
───────────────────────────
Live attendance from a webcam / CCTV stream: continuously detect faces, match
against Supabase, and mark attendance (per-day dedup).

Usage:
  python -m scripts.recognize_webcam
  (set CAMERA_SOURCE in .env to 0 for webcam, or an rtsp:// URL for CCTV)

Press Q to quit.
"""

import time

import cv2

from core.config import get_settings
from core.logging import setup_logging, get_logger
from service import recognition

settings = get_settings()


def main() -> None:
    setup_logging(settings.log_level, "plain")
    log = get_logger("recognize")

    cap = cv2.VideoCapture(settings.camera_source_resolved)
    if not cap.isOpened():
        log.error("Cannot open camera (check CAMERA_SOURCE in .env)")
        return

    print("\nLive attendance running. Press Q to quit.\n")
    last_infer = 0.0
    last_events: list[dict] = []

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        now = time.time()
        if now - last_infer > 0.7:   # throttle inference (~1.4 fps) to save CPU
            last_events = recognition.recognise_frame(frame, mark=True)
            last_infer = now
            for e in last_events:
                if e["matched"] and e["newly_marked"]:
                    print(f"  marked {e['entity_type']}: {e.get('name')} "
                          f"({int(e['similarity'] * 100)}%)")

        for e in last_events:
            x1, y1, x2, y2 = e["bbox"]
            if e["matched"]:
                color = (0, 255, 0) if e["newly_marked"] else (0, 200, 200)
                label = f"{e.get('name') or e['entity_id'][:8]} {int(e['similarity'] * 100)}%"
            else:
                color = (0, 0, 255)
                label = "unknown"
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, label, (x1, max(0, y1 - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        cv2.imshow("Live Attendance", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
