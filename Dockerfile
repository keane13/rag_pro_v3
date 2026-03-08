FROM python:3.11-slim

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .

# Fix encoding issue + install dependencies
RUN dos2unix requirements.txt && \
    python -m pip install --upgrade pip --root-user-action=ignore && \
    python -m pip install --no-cache-dir -r requirements.txt --root-user-action=ignore

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "src.interface.api:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
