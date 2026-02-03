# Use Python 3.12 slim image as base
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py .
COPY templates/ templates/

# Create data directory for persistent storage
RUN mkdir -p /app/data

# Expose port 5000
EXPOSE 5001

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Run the application
# Note: Using 0.0.0.0 to make the app accessible from outside the container
CMD ["python", "app.py", "--host", "0.0.0.0", "--port", "5001"]
