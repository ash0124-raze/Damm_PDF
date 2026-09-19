import boto3
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.config import settings
from db.session import get_db
from db.models import FileJob, JobStatus
from api.schemas import JobCreateRequest, JobResponse
from worker.tasks import process_pdf_task  # <-- Added this import
from fastapi_limiter.depends import RateLimiter
from fastapi import UploadFile, File, HTTPException
import os
import uuid
from worker.tasks import merge_pdfs_task # Adjust this import path if needed

router = APIRouter()

# Initialize the S3/R2 Client
s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT_URL,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    region_name='auto'
)



@router.post("/jobs/", 
    response_model=JobResponse, 
    dependencies=[Depends(RateLimiter(times=5, seconds=60))])
def create_job(job_req: JobCreateRequest, db: Session = Depends(get_db)):
    # 1. Create a database record for the new job
    new_job = FileJob(
        filename=job_req.filename,
        task_type=job_req.task_type,
        status=JobStatus.PENDING
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    
    # 2. Generate a unique key for cloud storage to prevent overwriting
    s3_key = f"job_{new_job.id}_{new_job.filename}"
    
    # 3. Generate the presigned URL for direct frontend upload
    try:
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': settings.S3_BUCKET_NAME, 
                'Key': s3_key,
                'ContentType': 'application/pdf'  # <-- Added this to fix the Network Error
            },
            ExpiresIn=3600
        )
        
        # Save the expected storage URL to the database
        new_job.original_file_url = f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{s3_key}"
        db.commit()
        
    except Exception as e:
        db.delete(new_job)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Could not generate upload URL: {str(e)}")
        
    # Return the job details AND the secure upload URL explicitly
    return {
        "id": new_job.id,
        "filename": new_job.filename,
        "status": new_job.status.value,
        "task_type": new_job.task_type,
        "created_at": new_job.created_at,
        "upload_url": presigned_url
    }

@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job_status(job_id: int, db: Session = Depends(get_db)):
    job = db.query(FileJob).filter(FileJob.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Convert SQLAlchemy object to dictionary so we can swap the URL
    job_data = {
        "id": job.id,
        "filename": job.filename,
        "status": job.status.value,
        "task_type": job.task_type,
        "created_at": job.created_at,
        "upload_url": job.original_file_url,
        "processed_file_url": job.processed_file_url
    }

    # If the job is done, intercept the raw URL and generate a signed download link
    if job.status.value.upper() == "COMPLETED" and job.processed_file_url:
        try:
            # Extract the exact S3 key (filename) from the URL saved by the worker
            s3_key = job.processed_file_url.split('/')[-1]
            
            presigned_download = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.S3_BUCKET_NAME, 
                    'Key': s3_key,
                    'ResponseContentDisposition': f'attachment; filename="compressed_{job.filename}"' # Forces browser to download instead of view
                },
                ExpiresIn=3600 # Link self-destructs in 1 hour
            )
            # Override the raw URL with the authorized temporary link
            job_data["processed_file_url"] = presigned_download
        except Exception as e:
            print(f"Presign error: {e}")
            
    return job_data
# <-- Added the missing route to trigger the Celery worker
@router.post("/jobs/{job_id}/process")
def start_processing(job_id: int, db: Session = Depends(get_db)):
    job = db.query(FileJob).filter(FileJob.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Drop the ticket into the Redis Queue
    process_pdf_task.delay(job.id)
    
    return {"message": "Processing started", "job_id": job.id}


@router.post("/merge")
async def merge_pdfs_endpoint(files: list[UploadFile] = File(...)):
    # 1. Basic Validation
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Please upload at least 2 PDFs to merge.")

    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)

    saved_file_paths = []

    # 2. Save each uploaded file temporarily
    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"File {file.filename} is not a PDF.")

        # Give each file a unique name to prevent collisions if multiple users upload "resume.pdf"
        file_path = os.path.join(temp_dir, f"{uuid.uuid4().hex[:6]}_{file.filename}")
        
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
            
        saved_file_paths.append(file_path)

    # 3. Define the final output filename
    output_filename = f"merged_{uuid.uuid4().hex[:8]}.pdf"

    # 4. Dispatch the Celery task in the background
    task = merge_pdfs_task.delay(saved_file_paths, output_filename)

    # 5. Return the Job ID so the frontend can poll for completion
    return {
        "message": "Merge job queued successfully",
        "job_id": task.id,
        "task_type": "merge"
    }
import os
import uuid
import boto3
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session

from core.config import settings
from db.session import get_db
from db.models import FileJob, JobStatus
from api.schemas import JobCreateRequest, JobResponse
from worker.tasks import process_pdf_task, merge_pdfs_task

router = APIRouter()

# Initialize the S3/R2 Client
s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT_URL,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    region_name='auto'
)

# LIGHTWEIGHT RATE LIMITER (Bypasses fastapi-limiter package bugs entirely)
async def check_rate_limit(request: Request):
    # Uses the FastAPI app's existing redis connection stored during lifespan
    redis_conn = request.app.state.redis if hasattr(request.app.state, "redis") else None
    if not redis_conn:
        return  # Fail open if redis isn't attached
        
    client_ip = request.client.host
    rate_key = f"ratelimit:{client_ip}:jobs"
    
    current = await redis_conn.incr(rate_key)
    if current == 1:
        await redis_conn.expire(rate_key, 60)  # Reset window in 60 seconds
        
    if current > 5:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please wait a minute.")


@router.post("/jobs/", response_model=JobResponse, dependencies=[Depends(check_rate_limit)])
def create_job(job_req: JobCreateRequest, db: Session = Depends(get_db)):
    # 1. Create a database record for the new job
    new_job = FileJob(
        filename=job_req.filename,
        task_type=job_req.task_type,
        status=JobStatus.PENDING
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    
    # 2. Generate a unique key for cloud storage to prevent overwriting
    s3_key = f"job_{new_job.id}_{new_job.filename}"
    
    # 3. Generate the presigned URL for direct frontend upload
    try:
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': settings.S3_BUCKET_NAME, 
                'Key': s3_key,
                'ContentType': 'application/pdf'
            },
            ExpiresIn=3600
        )
        
        new_job.original_file_url = f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{s3_key}"
        db.commit()
        
    except Exception as e:
        db.delete(new_job)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Could not generate upload URL: {str(e)}")
        
    return {
        "id": new_job.id,
        "filename": new_job.filename,
        "status": new_job.status.value,
        "task_type": new_job.task_type,
        "created_at": new_job.created_at,
        "upload_url": presigned_url
    }

@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job_status(job_id: int, db: Session = Depends(get_db)):
    job = db.query(FileJob).filter(FileJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    job_data = {
        "id": job.id,
        "filename": job.filename,
        "status": job.status.value,
        "task_type": job.task_type,
        "created_at": job.created_at,
        "upload_url": job.original_file_url,
        "processed_file_url": job.processed_file_url
    }

    if job.status.value.upper() == "COMPLETED" and job.processed_file_url:
        try:
            s3_key = job.processed_file_url.split('/')[-1]
            presigned_download = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.S3_BUCKET_NAME, 
                    'Key': s3_key,
                    'ResponseContentDisposition': f'attachment; filename="compressed_{job.filename}"'
                },
                ExpiresIn=3600
            )
            job_data["processed_file_url"] = presigned_download
        except Exception as e:
            print(f"Presign error: {e}")
            
    return job_data

@router.post("/jobs/{job_id}/process")
def start_processing(job_id: int, db: Session = Depends(get_db)):
    job = db.query(FileJob).filter(FileJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    process_pdf_task.delay(job.id)
    return {"message": "Processing started", "job_id": job.id}


@router.post("/merge")
async def merge_pdfs_endpoint(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Please upload at least 2 PDFs to merge.")

    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    saved_file_paths = []

    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"File {file.filename} is not a PDF.")

        file_path = os.path.join(temp_dir, f"{uuid.uuid4().hex[:6]}_{file.filename}")
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        saved_file_paths.append(file_path)

    output_filename = f"merged_{uuid.uuid4().hex[:8]}.pdf"
    task = merge_pdfs_task.delay(saved_file_paths, output_filename)

    return {
        "message": "Merge job queued successfully",
        "job_id": task.id,
        "task_type": "merge"
    }
from celery.result import AsyncResult
from worker.queue import celery_app

@router.get("/tasks/{task_id}")
def get_task_status(task_id: str):
    task_result = AsyncResult(task_id, app=celery_app)
    
    if task_result.state == "PENDING":
        return {"status": "PENDING"}
    elif task_result.state == "SUCCESS":
        return {"status": "SUCCESS", "result": task_result.result}
    elif task_result.state == "FAILURE":
        return {"status": "FAILURE", "error": str(task_result.info)}
        
    return {"status": task_result.state}
from worker.tasks import split_pdf_task

@router.post("/split")
async def split_pdf_endpoint(
    file: UploadFile = File(...), 
    start_page: int = 1, 
    end_page: int = 1
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    file_path = os.path.join(temp_dir, f"{uuid.uuid4().hex[:6]}_{file.filename}")

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    output_filename = f"split_{uuid.uuid4().hex[:8]}.pdf"
    task = split_pdf_task.delay(file_path, start_page, end_page, output_filename)

    return {
        "message": "Split job queued successfully",
        "job_id": task.id,
        "task_type": "split"
    }
from worker.tasks import images_to_pdf_task

@router.post("/images-to-pdf")
async def images_to_pdf_endpoint(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="Please upload at least one image.")

    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    saved_file_paths = []

    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"File {file.filename} is not a valid image.")

        file_path = os.path.join(temp_dir, f"{uuid.uuid4().hex[:6]}_{file.filename}")
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        saved_file_paths.append(file_path)

    output_filename = f"images_pdf_{uuid.uuid4().hex[:8]}.pdf"
    task = images_to_pdf_task.delay(saved_file_paths, output_filename)

    return {
        "message": "Images to PDF job queued successfully",
        "job_id": task.id,
        "task_type": "images_to_pdf"
    }

from worker.tasks import rotate_pdf_task

@router.post("/rotate")
async def rotate_pdf_endpoint(
    file: UploadFile = File(...), 
    angle: int = 90
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    file_path = os.path.join(temp_dir, f"{uuid.uuid4().hex[:6]}_{file.filename}")

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    output_filename = f"rotated_{uuid.uuid4().hex[:8]}.pdf"
    task = rotate_pdf_task.delay(file_path, angle, output_filename)

    return {
        "message": "Rotation job queued successfully",
        "job_id": task.id,
        "task_type": "rotate"
    }
from worker.tasks import pdf_to_images_task

@router.post("/pdf-to-images")
async def pdf_to_images_endpoint(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    file_path = os.path.join(temp_dir, f"{uuid.uuid4().hex[:6]}_{file.filename}")

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    output_filename = f"images_{uuid.uuid4().hex[:8]}.zip"
    task = pdf_to_images_task.delay(file_path, output_filename)

    return {
        "message": "PDF to Images job queued successfully",
        "job_id": task.id,
        "task_type": "pdf_to_images"
    }
from fastapi import Form
from worker.tasks import encrypt_pdf_task

@router.post("/encrypt")
async def encrypt_pdf_endpoint(
    file: UploadFile = File(...), 
    password: str = Form(...)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    if not password:
        raise HTTPException(status_code=400, detail="Password cannot be empty.")

    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    file_path = os.path.join(temp_dir, f"{uuid.uuid4().hex[:6]}_{file.filename}")

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    output_filename = f"encrypted_{uuid.uuid4().hex[:8]}.pdf"
    task = encrypt_pdf_task.delay(file_path, password, output_filename)

    return {
        "message": "Encryption job queued successfully",
        "job_id": task.id,
        "task_type": "encrypt"
    }
# import os
# import uuid
# import boto3
# from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, BackgroundTasks, Form
# from sqlalchemy.orm import Session
# from pypdf import PdfReader, PdfWriter

# from core.config import settings
# from db.session import get_db, SessionLocal
# from db.models import FileJob, JobStatus
# from api.schemas import JobCreateRequest, JobResponse

# router = APIRouter()

# # Initialize the S3/R2 Client
# s3_client = boto3.client(
#     's3',
#     endpoint_url=settings.S3_ENDPOINT_URL,
#     aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
#     aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
#     region_name='auto'
# )

# # Lightweight rate limiter fallback (bypasses Redis requirement)
# async def check_rate_limit(request: Request):
#     return


# # --- BACKGROUND WORKERS WITH S3 UPLOAD ---

# def process_pdf_background(job_id: int, task_type: str, file_path: str = None, **kwargs):
#     """Background worker that processes files locally, uploads to S3/R2, and updates DB status."""
#     db = SessionLocal()
#     output_path = None
#     try:
#         job = db.query(FileJob).filter(FileJob.id == job_id).first()
#         if not job:
#             return

#         job.status = JobStatus.PROCESSING
#         db.commit()

#         output_dir = "processed_files"
#         os.makedirs(output_dir, exist_ok=True)
        
#         # Tool-specific logic
#         if task_type == "rotate":
#             angle = kwargs.get("angle", 90)
#             output_filename = f"rotated_{uuid.uuid4().hex[:8]}.pdf"
#             output_path = os.path.join(output_dir, output_filename)
            
#             reader = PdfReader(file_path)
#             writer = PdfWriter()
#             for page in reader.pages:
#                 page.rotate(angle)
#                 writer.add_page(page)
#             with open(output_path, "wb") as f:
#                 writer.write(f)

#         elif task_type == "encrypt":
#             password = kwargs.get("password")
#             output_filename = f"encrypted_{uuid.uuid4().hex[:8]}.pdf"
#             output_path = os.path.join(output_dir, output_filename)
            
#             reader = PdfReader(file_path)
#             writer = PdfWriter()
#             for page in reader.pages:
#                 writer.add_page(page)
#             writer.encrypt(password)
#             with open(output_path, "wb") as f:
#                 writer.write(f)

#         # CRITICAL: Upload processed file to S3/R2
#         s3_key = f"processed_{output_filename}"
#         s3_client.upload_file(
#             output_path, 
#             settings.S3_BUCKET_NAME, 
#             s3_key,
#             ExtraArgs={'ContentType': 'application/pdf'}
#         )

#         job.processed_file_url = f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{s3_key}"
#         job.status = JobStatus.COMPLETED
#         db.commit()

#     except Exception as e:
#         print(f"Background task error ({task_type}): {e}")
#         job.status = JobStatus.FAILED
#         db.commit()
#     finally:
#         db.close()
#         if file_path and os.path.exists(file_path):
#             os.remove(file_path)
#         if output_path and os.path.exists(output_path):
#             os.remove(output_path)


# # --- API ENDPOINTS ---

# @router.post("/jobs/", response_model=JobResponse, dependencies=[Depends(check_rate_limit)])
# def create_job(job_req: JobCreateRequest, db: Session = Depends(get_db)):
#     new_job = FileJob(
#         filename=job_req.filename,
#         task_type=job_req.task_type,
#         status=JobStatus.PENDING
#     )
#     db.add(new_job)
#     db.commit()
#     db.refresh(new_job)
    
#     s3_key = f"job_{new_job.id}_{new_job.filename}"
    
#     try:
#         presigned_url = s3_client.generate_presigned_url(
#             'put_object',
#             Params={
#                 'Bucket': settings.S3_BUCKET_NAME, 
#                 'Key': s3_key,
#                 'ContentType': 'application/pdf'
#             },
#             ExpiresIn=3600
#         )
#         new_job.original_file_url = f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{s3_key}"
#         db.commit()
#     except Exception as e:
#         db.delete(new_job)
#         db.commit()
#         raise HTTPException(status_code=500, detail=f"Could not generate upload URL: {str(e)}")
        
#     return {
#         "id": new_job.id,
#         "filename": new_job.filename,
#         "status": new_job.status.value,
#         "task_type": new_job.task_type,
#         "created_at": new_job.created_at,
#         "upload_url": presigned_url
#     }


# @router.get("/jobs/{job_id}", response_model=JobResponse)
# def get_job_status(job_id: int, db: Session = Depends(get_db)):
#     job = db.query(FileJob).filter(FileJob.id == job_id).first()
#     if not job:
#         raise HTTPException(status_code=404, detail="Job not found")
        
#     # Map database status to frontend-friendly status strings
#     status_map = {
#         JobStatus.PENDING: "PENDING",
#         JobStatus.PROCESSING: "PROCESSING",
#         JobStatus.COMPLETED: "SUCCESS",  # Frontend expects SUCCESS
#         JobStatus.FAILED: "FAILURE"      # Frontend expects FAILURE
#     }

#     current_status = status_map.get(job.status, "PENDING")
    
#     job_data = {
#         "id": job.id,
#         "filename": job.filename,
#         "status": current_status,
#         "task_type": job.task_type,
#         "created_at": job.created_at,
#         "upload_url": job.original_file_url,
#         "processed_file_url": job.processed_file_url,
#         "result": None
#     }

#     if job.status == JobStatus.COMPLETED and job.processed_file_url:
#         try:
#             s3_key = job.processed_file_url.split('/')[-1]
#             presigned_download = s3_client.generate_presigned_url(
#                 'get_object',
#                 Params={
#                     'Bucket': settings.S3_BUCKET_NAME, 
#                     'Key': s3_key,
#                     'ResponseContentDisposition': f'attachment; filename="processed_{job.filename}"'
#                 },
#                 ExpiresIn=3600
#             )
#             job_data["result"] = {"file_url": presigned_download}
#             job_data["processed_file_url"] = presigned_download
#         except Exception as e:
#             print(f"Presign download error: {e}")
            
#     return job_data


# @router.post("/jobs/{job_id}/process")
# def start_processing(job_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
#     job = db.query(FileJob).filter(FileJob.id == job_id).first()
#     if not job:
#         raise HTTPException(status_code=404, detail="Job not found")
        
#     background_tasks.add_task(process_pdf_background, job.id, job.task_type)
#     return {"message": "Processing started in background", "job_id": job.id}


# @router.post("/merge")
# async def merge_pdfs_endpoint(files: list[UploadFile] = File(...), background_tasks: BackgroundTasks = BackgroundTasks(), db: Session = Depends(get_db)):
#     if len(files) < 2:
#         raise HTTPException(status_code=400, detail="Please upload at least 2 PDFs to merge.")

#     new_job = FileJob(filename="merged_document.pdf", task_type="merge", status=JobStatus.PENDING)
#     db.add(new_job)
#     db.commit()
#     db.refresh(new_job)

#     temp_dir = "temp_uploads"
#     os.makedirs(temp_dir, exist_ok=True)
#     saved_file_paths = []

#     for file in files:
#         if not file.filename.lower().endswith(".pdf"):
#             raise HTTPException(status_code=400, detail=f"File {file.filename} is not a PDF.")
#         file_path = os.path.join(temp_dir, f"{uuid.uuid4().hex[:6]}_{file.filename}")
#         with open(file_path, "wb") as buffer:
#             buffer.write(await file.read())
#         saved_file_paths.append(file_path)

#     def background_merge(j_id: int, paths: list[str]):
#         inner_db = SessionLocal()
#         output_path = None
#         try:
#             j = inner_db.query(FileJob).filter(FileJob.id == j_id).first()
#             j.status = JobStatus.PROCESSING
#             inner_db.commit()

#             output_filename = f"merged_{uuid.uuid4().hex[:8]}.pdf"
#             output_path = os.path.join("processed_files", output_filename)
#             os.makedirs("processed_files", exist_ok=True)

#             writer = PdfWriter()
#             for p in paths:
#                 reader = PdfReader(p)
#                 for page in reader.pages:
#                     writer.add_page(page)
#             with open(output_path, "wb") as f:
#                 writer.write(f)

#             s3_key = f"processed_{output_filename}"
#             s3_client.upload_file(
#                 output_path, 
#                 settings.S3_BUCKET_NAME, 
#                 s3_key,
#                 ExtraArgs={'ContentType': 'application/pdf'}
#             )

#             j.processed_file_url = f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{s3_key}"
#             j.status = JobStatus.COMPLETED
#             inner_db.commit()
#         except Exception as e:
#             print(f"Merge task error: {e}")
#             j.status = JobStatus.FAILED
#             inner_db.commit()
#         finally:
#             inner_db.close()
#             for p in paths:
#                 if os.path.exists(p):
#                     os.remove(p)
#             if output_path and os.path.exists(output_path):
#                 os.remove(output_path)

#     background_tasks.add_task(background_merge, new_job.id, saved_file_paths)

#     return {
#         "message": "Merge job queued successfully",
#         "job_id": new_job.id,
#         "task_type": "merge"
#     }


# @router.post("/split")
# async def split_pdf_endpoint(file: UploadFile = File(...), start_page: int = 1, end_page: int = 1, background_tasks: BackgroundTasks = BackgroundTasks(), db: Session = Depends(get_db)):
#     if not file.filename.lower().endswith(".pdf"):
#         raise HTTPException(status_code=400, detail="File must be a PDF.")

#     new_job = FileJob(filename=file.filename, task_type="split", status=JobStatus.PENDING)
#     db.add(new_job)
#     db.commit()
#     db.refresh(new_job)

#     temp_dir = "temp_uploads"
#     os.makedirs(temp_dir, exist_ok=True)
#     file_path = os.path.join(temp_dir, f"{uuid.uuid4().hex[:6]}_{file.filename}")
#     with open(file_path, "wb") as buffer:
#         buffer.write(await file.read())

#     def background_split(j_id: int, path: str, s_page: int, e_page: int):
#         inner_db = SessionLocal()
#         output_path = None
#         try:
#             j = inner_db.query(FileJob).filter(FileJob.id == j_id).first()
#             j.status = JobStatus.PROCESSING
#             inner_db.commit()

#             output_filename = f"split_{uuid.uuid4().hex[:8]}.pdf"
#             output_path = os.path.join("processed_files", output_filename)
#             os.makedirs("processed_files", exist_ok=True)

#             reader = PdfReader(path)
#             writer = PdfWriter()
#             for idx in range(s_page - 1, min(e_page, len(reader.pages))):
#                 writer.add_page(reader.pages[idx])

#             with open(output_path, "wb") as f:
#                 writer.write(f)

#             s3_key = f"processed_{output_filename}"
#             s3_client.upload_file(
#                 output_path, 
#                 settings.S3_BUCKET_NAME, 
#                 s3_key,
#                 ExtraArgs={'ContentType': 'application/pdf'}
#             )

#             j.processed_file_url = f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{s3_key}"
#             j.status = JobStatus.COMPLETED
#             inner_db.commit()
#         except Exception as e:
#             print(f"Split task error: {e}")
#             j.status = JobStatus.FAILED
#             inner_db.commit()
#         finally:
#             inner_db.close()
#             if os.path.exists(path):
#                 os.remove(path)
#             if output_path and os.path.exists(output_path):
#                 os.remove(output_path)

#     background_tasks.add_task(background_split, new_job.id, file_path, start_page, end_page)

#     return {
#         "message": "Split job queued successfully",
#         "job_id": new_job.id,
#         "task_type": "split"
#     }


# @router.post("/rotate")
# async def rotate_pdf_endpoint(file: UploadFile = File(...), angle: int = 90, background_tasks: BackgroundTasks = BackgroundTasks(), db: Session = Depends(get_db)):
#     if not file.filename.lower().endswith(".pdf"):
#         raise HTTPException(status_code=400, detail="File must be a PDF.")

#     new_job = FileJob(filename=file.filename, task_type="rotate", status=JobStatus.PENDING)
#     db.add(new_job)
#     db.commit()
#     db.refresh(new_job)

#     temp_dir = "temp_uploads"
#     os.makedirs(temp_dir, exist_ok=True)
#     file_path = os.path.join(temp_dir, f"{uuid.uuid4().hex[:6]}_{file.filename}")
#     with open(file_path, "wb") as buffer:
#         buffer.write(await file.read())

#     background_tasks.add_task(process_pdf_background, new_job.id, "rotate", file_path=file_path, angle=angle)

#     return {
#         "message": "Rotation job queued successfully",
#         "job_id": new_job.id,
#         "task_type": "rotate"
#     }


# @router.post("/encrypt")
# async def encrypt_pdf_endpoint(file: UploadFile = File(...), password: str = Form(...), background_tasks: BackgroundTasks = BackgroundTasks(), db: Session = Depends(get_db)):
#     if not file.filename.lower().endswith(".pdf"):
#         raise HTTPException(status_code=400, detail="File must be a PDF.")
#     if not password:
#         raise HTTPException(status_code=400, detail="Password cannot be empty.")

#     new_job = FileJob(filename=file.filename, task_type="encrypt", status=JobStatus.PENDING)
#     db.add(new_job)
#     db.commit()
#     db.refresh(new_job)

#     temp_dir = "temp_uploads"
#     os.makedirs(temp_dir, exist_ok=True)
#     file_path = os.path.join(temp_dir, f"{uuid.uuid4().hex[:6]}_{file.filename}")
#     with open(file_path, "wb") as buffer:
#         buffer.write(await file.read())

#     background_tasks.add_task(process_pdf_background, new_job.id, "encrypt", file_path=file_path, password=password)

#     return {
#         "message": "Encryption job queued successfully",
#         "job_id": new_job.id,
#         "task_type": "encrypt"
#     }


# @router.get("/tasks/{task_id}")
# def get_task_status_alias(task_id: int, db: Session = Depends(get_db)):
#     """Maps frontend polling requests targeting /tasks/{id} directly to job tracking."""
#     return get_job_status(task_id, db)