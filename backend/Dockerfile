# AEGIS backend — FastAPI + SQLite + Cognee cloud.
# Build context is the backend/ directory (see render.yaml dockerContext).
FROM python:3.11-slim

# git: used by scripts/import_cryptoscamdb.py to clone the CryptoScamDB blacklist.
# curl: used by the container HEALTHCHECK below.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git curl \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install deps first so Docker layer-caches them across code changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App source.
COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

# Shell form so ${PORT} (injected by Render/other PaaS) is expanded at runtime.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
