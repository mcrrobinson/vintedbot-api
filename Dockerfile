# Stage 1: Build
FROM public.ecr.aws/docker/library/node:lts-alpine3.20 as builder

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json, package-lock.json, and tsconfig.json to the working directory
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies including devDependencies for building the app
RUN npm install

# Copy the rest of the application code to the container
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN npx tsc

# Stage 2: Production
FROM public.ecr.aws/docker/library/node:lts-alpine3.20

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to install only production dependencies
COPY package*.json ./

# For healthcheck
RUN apk add --no-cache curl

# Install only production dependencies
RUN npm install --only=production

COPY --from=builder /usr/src/app/dist ./src
COPY src/mapping.json ./src

# Expose the ports the app runs on
EXPOSE 80

# Add a script that runs everything
CMD ["node","src/app.js"]