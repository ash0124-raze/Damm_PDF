# from pydantic import BaseModel
# from typing import Optional
# from datetime import datetime

# # What the frontend sends to the API
# class JobCreateRequest(BaseModel):
#     filename: str
#     task_type: str  # e.g., 'compress', 'merge', 'watermark'

# # What the API returns to the frontend
# class JobResponse(BaseModel):
#     id: int
#     filename: str
#     status: str
#     task_type: str
#     created_at: datetime
#     upload_url: Optional[str] = None # The AWS/Cloudflare upload link

#     class Config:
#         from_attributes = True  # Tells Pydantic to read SQLAlchemy models


from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

# What the frontend sends to the API
class JobCreateRequest(BaseModel):
    filename: str
    task_type: str  # e.g., 'compress', 'merge', 'watermark'

class JobResponse(BaseModel):
    id: int
    filename: str
    status: str
    task_type: str
    created_at: datetime
    upload_url: Optional[str] = None  # The AWS/Cloudflare upload link
    processed_file_url: Optional[str] = None

    # This tells Pydantic to magically parse SQLAlchemy database objects
    model_config = ConfigDict(from_attributes=True)