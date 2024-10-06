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

# Install only production dependencies
RUN npm install --only=production

COPY --from=builder /usr/src/app/dist ./src

# Just a nullbase for testing without certs
COPY --from=builder /usr/src/app/src/privkey.pem ./src
COPY --from=builder /usr/src/app/src/cert.pem ./src

# Install Certbot for managing SSL certificates
RUN apk add --no-cache certbot

# Expose the ports the app runs on
EXPOSE 80
EXPOSE 443

# Add a script that runs everything
CMD sh -c "certbot certonly --standalone -d lemontree.zapto.org --non-interactive --agree-tos -m mrmcrrobinson@gmail.com && (crontab -l 2>/dev/null; echo '0 0,12 * * * certbot renew --standalone') | crontab - && node src/app.js"
