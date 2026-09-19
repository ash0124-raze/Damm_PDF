import os
import sys
import platform
import subprocess
import boto3
from pypdf import PdfWriter,PdfReader
from worker.queue import celery_app  # Single source of truth for your Celery app
from db.session import SessionLocal
from db.models import FileJob, JobStatus
from core.config import settings

# Initialize S3 Client
s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT_URL,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    region_name='auto'
)

@celery_app.task(bind=True, max_retries=3)
def process_pdf_task(self, job_id: int):
    db = SessionLocal()
    job = db.query(FileJob).filter(FileJob.id == job_id).first()
    
    if not job:
        db.close()
        return
        
    job.status = JobStatus.PROCESSING
    db.commit()
    
    input_path = f"input_{job_id}.pdf"
    output_path = f"output_{job_id}.pdf"
    s3_input_key = f"job_{job_id}_{job.filename}"
    s3_output_key = f"processed_{job_id}_{job.filename}"
    
    try:
        # 1. Download file from Cloudflare R2
        s3_client.download_file(settings.S3_BUCKET_NAME, s3_input_key, input_path)
        
        # 2. Determine the correct Ghostscript command for the OS
        gs_exec = "gswin64c" if platform.system() == "Windows" else "gs"
        
        # 3. Execute Ghostscript Compression
        if job.task_type == "compress":
            gs_command = [
                gs_exec, 
                "-sDEVICE=pdfwrite",       # Tells GS to output a PDF
                "-dCompatibilityLevel=1.4",# Ensures the PDF is readable by older software
                "-dPDFSETTINGS=/screen",   # The compression level
                "-dNOPAUSE",               # Don't prompt the user for input
                "-dQUIET",                 # Suppress terminal spam
                "-dBATCH",                 # Exit when finished
                f"-sOutputFile={output_path}", 
                input_path
            ]
            
            # Run the command and wait for it to finish
            subprocess.run(gs_command, check=True)
            
        # 4. Upload the compressed file back to R2
        s3_client.upload_file(output_path, settings.S3_BUCKET_NAME, s3_output_key)
        
        # 5. Mark as completed and save the new URL
        job.status = JobStatus.COMPLETED
        job.processed_file_url = f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{s3_output_key}"
        db.commit()
        
    except Exception as e:
        job.status = JobStatus.FAILED
        db.commit()
        raise self.retry(exc=e, countdown=10)
        
    finally:
        # 6. Cleanup local files to save storage
        if os.path.exists(input_path): os.remove(input_path)
        if os.path.exists(output_path): os.remove(output_path)
        db.close()


@celery_app.task(bind=True)
def merge_pdfs_task(self, file_paths: list, output_filename: str):
    """
    Takes a list of file paths, merges them in order, and saves to an output directory.
    """
    output_dir = "processed_files"
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, output_filename)
    
    # Initialize the PDF Writer
    merger = PdfWriter()
    
    try:
        # Append each file to the merger
        for path in file_paths:
            merger.append(path)
            
        # Write the combined file to disk
        merger.write(output_path)
        merger.close()
        
        # Clean up the original uploaded files to save space
        for path in file_paths:
            if os.path.exists(path):
                os.remove(path)
                
        return {"status": "success", "file_url": f"/download/{output_filename}"}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
# from pypdf import , PdfWriter

@celery_app.task(bind=True)
def split_pdf_task(self, file_path: str, start_page: int, end_page: int, output_filename: str):
    output_dir = "processed_files"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, output_filename)

    reader = PdfReader(file_path)
    writer = PdfWriter()

    try:
        # pypdf uses 0-based indexing, user inputs 1-based page numbers
        start_idx = max(0, start_page - 1)
        end_idx = min(len(reader.pages), end_page)

        for page_num in range(start_idx, end_idx):
            writer.add_page(reader.pages[page_num])

        with open(output_path, "wb") as output_file:
            writer.write(output_file)

        return {"status": "success", "file_url": f"/download/{output_filename}"}

    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

from PIL import Image

@celery_app.task(bind=True)
def images_to_pdf_task(self, file_paths: list[str], output_filename: str):
    output_dir = "processed_files"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, output_filename)

    try:
        images = []
        for path in file_paths:
            img = Image.open(path).convert("RGB")
            images.append(img)
        
        if images:
            images[0].save(
                output_path,
                "PDF",
                save_all=True,
                append_images=images[1:]
            )
        
        for img in images:
            img.close()

        return {"status": "success", "file_url": f"/download/{output_filename}"}

    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        for path in file_paths:
            if os.path.exists(path):
                os.remove(path)

from pypdf import PdfReader, PdfWriter

@celery_app.task(bind=True)
def rotate_pdf_task(self, file_path: str, rotation_angle: int, output_filename: str):
    output_dir = "processed_files"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, output_filename)

    reader = PdfReader(file_path)
    writer = PdfWriter()

    try:
        for page in reader.pages:
            page.rotate(rotation_angle)
            writer.add_page(page)

        with open(output_path, "wb") as output_file:
            writer.write(output_file)

        return {"status": "success", "file_url": f"/download/{output_filename}"}

    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

import fitz  # PyMuPDF
import zipfile

@celery_app.task(bind=True)
def pdf_to_images_task(self, file_path: str, output_filename: str):
    output_dir = "processed_files"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, output_filename)

    doc = fitz.open(file_path)
    image_paths = []

    try:
        temp_img_dir = "temp_images"
        os.makedirs(temp_img_dir, exist_ok=True)

        for page_num in range(len(doc)):
            page = doc[page_num]
            pix = page.get_pixmap(dpi=150)
            img_path = os.path.join(temp_img_dir, f"page_{page_num + 1}.png")
            pix.save(img_path)
            image_paths.append(img_path)

        with zipfile.ZipFile(output_path, 'w') as zipf:
            for img_path in image_paths:
                zipf.write(img_path, os.path.basename(img_path))

        return {"status": "success", "file_url": f"/download/{output_filename}"}

    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        doc.close()
        if os.path.exists(file_path):
            os.remove(file_path)
        for img_path in image_paths:
            if os.path.exists(img_path):
                os.remove(img_path)

# from pypdf import PdfReader, PdfWriter

@celery_app.task(bind=True)
def encrypt_pdf_task(self, file_path: str, password: str, output_filename: str):
    output_dir = "processed_files"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, output_filename)

    reader = PdfReader(file_path)
    writer = PdfWriter()

    try:
        for page in reader.pages:
            writer.add_page(page)
        
        # Apply password encryption
        writer.encrypt(password)

        with open(output_path, "wb") as output_file:
            writer.write(output_file)

        return {"status": "success", "file_url": f"/download/{output_filename}"}

    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)