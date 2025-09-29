# Simple Node.js API image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package manifests first (better layer cache)
COPY package*.json ./

# Install production deps (nodemon not needed in container runtime)
RUN npm install --only=production && npm cache clean --force

# Copy source
COPY index.js ./

# Expose API port
EXPOSE 8000

# Default environment (can be overridden by compose)
ENV PORT=8000

CMD ["node", "index.js"]
