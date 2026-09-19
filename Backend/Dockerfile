# # Use a lightweight Python image
# FROM python:3.11-slim

# # Install system dependencies, specifically Ghostscript for PDF compression
# RUN apt-get update && \
#     apt-get install -y ghostscript && \
#     rm -rf /var/lib/apt/lists/*

# # Set the working directory inside the container
# WORKDIR /app

# # Copy dependency list and install them
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# # Copy your entire backend codebase into the container
# COPY . .

# Lightweight Python image
# FROM python:3.11-slim

# # Install Ghostscript
# RUN apt-get update && \
#     apt-get install -y ghostscript && \
#     rm -rf /var/lib/apt/lists/*

# # Container working directory
# WORKDIR /app

# # Install Python dependencies
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# # Copy backend code
# COPY . .

# # Render provides PORT automatically
# CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]

FROM python:3.11-slim

RUN apt-get update && \
    apt-get install -y ghostscript && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

CMD ["./start.sh"]