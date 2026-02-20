FROM node:20-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build the project
RUN npm run build

# Expose ports
EXPOSE 5000 5001

# Start both backend and frontend
CMD ["sh", "-c", "npm run dev & npm run dev:client"]
