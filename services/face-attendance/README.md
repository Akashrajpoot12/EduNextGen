# Face Attendance Service

A **separate companion service** for the SMS (school management) app. It does the
camera + AI work (which can't run on Vercel/serverless) and writes attendance
**directly into the same Supabase database** the web app uses — so Admin/Parent
screens show it automatically.

- **Detector:** SCRFD (insightface)
- **Recognition:** ArcFace 512-d embeddings (insightface `buffalo_l`)
- **Matching + storage:** Supabase `face_embeddings` + `match_face_embedding` RPC
- **Attendance:** `daily_attendance` (students) / `staff_attendance` (teachers & staff)

> Requires DB migration `00032_face_attendance_foundation.sql` to be applied first.

---

## How it works

```
camera ─▶ SCRFD detect ─▶ ArcFace embed ─▶ match_face_embedding (Supabase)
                                                 │
                                       ┌─────────┴──────────┐
                                  student?              staff/teacher?
                                       ▼                      ▼
                              daily_attendance        staff_attendance   (Supabase)
```

Students live in `public.students`; teachers **and** non-teaching staff both live
in `public.users` (distinguished by `user_roles`). `entity_type` is `"student"`
or `"staff"` everywhere in this service.

---

## Setup

```bash
cd services/face-attendance
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt

cp .env.example .env     # then fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, SCHOOL_ID
```

The first run downloads the `buffalo_l` model pack (~250 MB) into `models_cache/`.

---

## Enroll a person (first-time, 15+ photos)

Take the person's `students.id` or `users.id` (UUID) from the database, then:

```bash
# staff / teacher
python -m scripts.enroll_webcam --type staff --id <users.id> --shots 15

# student
python -m scripts.enroll_webcam --type student --id <students.id> --shots 15
```

Press **SPACE** to capture each shot, following the on-screen angle hint
(straight, left, right, up, down, with/without glasses…). More variety = better
accuracy. Re-enroll with `--overwrite` to replace old embeddings.

---

## Run live attendance

```bash
python -m scripts.recognize_webcam
```

Set `CAMERA_SOURCE` in `.env` to `0` for a webcam or an `rtsp://…` URL for CCTV.
Each recognised person is marked **present** once per day (dedup).

---

## Run as an API (optional)

```bash
python -m api.main          # http://localhost:8000  (docs at /docs)
```

| Method | Path        | Body (multipart)                                  |
|--------|-------------|---------------------------------------------------|
| GET    | `/health`   | —                                                 |
| POST   | `/register` | `entity_type`, `entity_id`, `overwrite`, `files[]`|
| POST   | `/recognize`| `file`, `mark`                                     |

---

## Tuning accuracy

- `MATCH_SIMILARITY_THRESHOLD` (default `0.5`): raise → stricter (fewer false
  matches, more "unknown"); lower → looser.
- Enroll **10–15+ varied photos** per person — this matters more than anything.
- GPU: `pip install onnxruntime-gpu` and set `DEVICE=cuda` in `.env`.

## Security

`SUPABASE_SERVICE_KEY` is the **service_role** key — it bypasses RLS. Keep it on
the server/kiosk only; never expose it to a browser.
