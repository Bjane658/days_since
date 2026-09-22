# Use official Bun image as base
FROM oven/bun:1.3-slim

# Set working directory
WORKDIR /app

# Copy application files (no dependencies to install)
COPY package.json ./
COPY app.js store.js render.js ./
COPY templates/ templates/
COPY static/ static/

# Create data directory for persistent storage
RUN mkdir -p /app/data

# Expose port 5001
EXPOSE 5001

# Run the application
# Note: Using 0.0.0.0 to make the app accessible from outside the container
CMD ["bun", "app.js", "--host", "0.0.0.0", "--port", "5001"]
