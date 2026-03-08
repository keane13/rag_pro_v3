FROM python:3.11-slim

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and fix encoding
COPY requirements.txt .

# Convert UTF-16 to UTF-8 then install
RUN python -c "
with open('requirements.txt', 'rb') as f:
    content = f.read()
if content[:2] in (b'\xff\xfe', b'\xfe\xff'):
    content = content.decode('utf-16').encode('utf-8')
with open('requirements.txt', 'wb') as f:
    f.write(content)
" && \
    python -m pip install --upgrade pip --root-user-action=ignore && \
    python -m pip install --no-cache-dir -r requirements.txt --root-user-action=ignore

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "src.interface.api:app", "--host", "0.0.0.0", "--port", "8000"]
