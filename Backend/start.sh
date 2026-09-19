#!/bin/bash

echo "Starting Celery worker..."

celery -A worker.queue.celery_app worker \
    --pool=solo \
    --loglevel=info &

echo "Starting FastAPI..."

uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}