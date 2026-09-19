from celery import Celery
from core.config import settings

# Initialize Celery
# 'pdf_worker' is the name of our application
# 'broker' is where Celery looks for new tasks (Upstash Redis)
# 'backend' is where Celery stores the results of tasks (also Upstash Redis)
celery_app = Celery(
    "pdf_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

# Optional: Configure Celery for production reliability
celery_app.conf.update(
    # Tells Celery where to find the actual task functions we will write next
    imports=["worker.tasks"],
    
    # If a worker crashes while processing a PDF, put the job back in the queue
    task_acks_late=True,
    
    # Only fetch one PDF task at a time per worker process to save memory
    worker_prefetch_multiplier=1,
    
    # Set a hard time limit (e.g., 5 minutes) so a broken PDF doesn't freeze the server forever
    task_time_limit=300 
)