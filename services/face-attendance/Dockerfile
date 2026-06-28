# Face Attendance Service
FROM python:3.11-slim

# OpenCV runtime libs
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Model pack (~250MB) downloads into models_cache/ on first startup (lifespan
# preload). Mount a volume at /app/models_cache to persist it across restarts.
EXPOSE 8000

# Single worker: the ML models live in-process (one copy). Scale with replicas,
# not --workers, and put a reverse proxy in front.
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
