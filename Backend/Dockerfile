# Use a lightweight Python image
FROM python:3.11-slim

# Install system dependencies, specifically Ghostscript for PDF compression
RUN apt-get update && \
    apt-get install -y ghostscript && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy dependency list and install them
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your entire backend codebase into the container
COPY . .