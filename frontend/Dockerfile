# FROM node:18-alpine
# FROM node:20-alpine
FROM node:20-slim


# Set the working directory
WORKDIR /app

# Install dependencies first to leverage Docker cache
COPY package.json ./
RUN npm install

# Copy the rest of the frontend code
COPY . .

# Expose the Next.js default port
EXPOSE 3000

# Run the development server
CMD ["npm", "run", "dev"]