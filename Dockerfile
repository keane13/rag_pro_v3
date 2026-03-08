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
RUN python -c "f=open('requirements.txt','rb');c=f.read();f.close();c=c.decode('utf-16').encode('utf-8') if c[:2] in (b'\xff\xfe',b'\xfe\xff') else c;f=open('requirements.txt','wb');f.write(c);f.close()" && \
    python -m pip install --upgrade pip --root-user-action=ignore && \
    python -m pip install --no-cache-dir -r requirements.txt --root-user-action=ignore

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "src.interface.api:app", "--host", "0.0.0.0", "--port", "8000"]
