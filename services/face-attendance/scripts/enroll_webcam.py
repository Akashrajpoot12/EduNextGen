"""
scripts/enroll_webcam.py
────────────────────────
Enroll a person from a live webcam — exactly the "first time, take 15+ photos at
different angles" flow.

Press SPACE to capture each shot (follow the on-screen angle hint), Q to finish.
All captured photos are turned into embeddings and stored in Supabase.

Usage:
  python -m scripts.enroll_webcam --type staff   --id <users.id UUID>    --shots 15
  python -m scripts.enroll_webcam --type student --id <students.id UUID> --shots 15
"""

import argparse
import sys

import cv2

from core.config import get_settings
from core.logging import setup_logging, get_logger
from service import registration

settings = get_settings()

ANGLE_HINTS = [
    "Look STRAIGHT at the camera",
    "Turn head slightly LEFT",
    "Turn head slightly RIGHT",
    "Tilt head UP a little",
    "Tilt head DOWN a little",
    "Look straight (slight SMILE)",
    "Look straight (neutral)",
    "Left ~30 degrees",
    "Right ~30 degrees",
    "Step a little CLOSER",
    "Step a little BACK",
    "Straight (with glasses, if any)",
    "Straight (without glasses, if any)",
    "Slight left",
    "Slight right",
]


def main() -> None:
    setup_logging(settings.log_level, "plain")
    log = get_logger("enroll")

    ap = argparse.ArgumentParser()
    ap.add_argument("--type", required=True, choices=["student", "staff"])
    ap.add_argument("--id", required=True, help="students.id or users.id (UUID)")
    ap.add_argument("--shots", type=int, default=15)
    ap.add_argument("--overwrite", action="store_true",
                    help="delete existing embeddings for this person first")
    args = ap.parse_args()

    cap = cv2.VideoCapture(settings.camera_source_resolved)
    if not cap.isOpened():
        log.error("Cannot open camera (check CAMERA_SOURCE in .env)")
        sys.exit(1)

    frames = []
    print(f"\nCapturing up to {args.shots} photos for {args.type} {args.id}")
    print("SPACE = capture   |   Q = finish early\n")

    while len(frames) < args.shots:
        ok, frame = cap.read()
        if not ok:
            break
        n = len(frames)
        hint = ANGLE_HINTS[n % len(ANGLE_HINTS)]
        disp = frame.copy()
        cv2.putText(disp, f"[{n}/{args.shots}] {hint}", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.putText(disp, "SPACE = capture    Q = finish", (20, 78),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
        cv2.imshow("Enroll - Face Attendance", disp)

        key = cv2.waitKey(1) & 0xFF
        if key == ord(" "):
            frames.append(frame.copy())
            print(f"  captured {len(frames)}/{args.shots}")
        elif key in (ord("q"), 27):
            break

    cap.release()
    cv2.destroyAllWindows()

    if len(frames) < 3:
        log.error("Need at least 3 photos — aborting.")
        sys.exit(1)

    res = registration.register_frames(
        entity_type=args.type, entity_id=args.id, frames=frames, overwrite=args.overwrite
    )
    print("\nEnrollment result:", res)
    if res["skipped"]:
        print(f"Note: {res['skipped']} photo(s) had no detectable face and were skipped.")
    print(f"Total embeddings now on record for this person: {res['total_on_record']}")


if __name__ == "__main__":
    main()
