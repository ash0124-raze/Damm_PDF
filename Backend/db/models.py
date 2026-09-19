from sqlalchemy import Column, Integer, String, DateTime, Enum
from datetime import datetime, timezone
import enum
from db.session import Base

# Define strict states for the file processing
class JobStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class FileJob(Base):
    __tablename__ = "file_jobs"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    # The URL where the file is stored in Cloudflare R2
    original_file_url = Column(String, nullable=True) 
    processed_file_url = Column(String, nullable=True)
    
    # Track the exact status
    status = Column(Enum(JobStatus), default=JobStatus.PENDING)
    
    # Track what kind of task this is (e.g., 'compress', 'merge')
    task_type = Column(String, index=True)
    
    # Timestamps are critical for automatically deleting old files later
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))