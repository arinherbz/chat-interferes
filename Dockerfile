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

# Build the project (creates dist/ folder)
RUN npm run build

# Expose ports
EXPOSE 5000

# Start production server
CMD ["npm", "start"]
