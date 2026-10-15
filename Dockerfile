# Base image
FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Install necessary dependencies, including Chromium for Puppeteer
# Install Chromium
RUN apt-get update && apt-get install -y \
  qpdf \
  chromium chromium-driver \
  libxss1 \
  libappindicator3-1 \
  fonts-liberation \
  libnspr4 \
  libnss3 \
  lsb-release \
  wget \
  ca-certificates && \
  ln -s /usr/bin/chromium /usr/bin/chromium-browser && \
  apt-get clean



# Set environment variables for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy package.json and package-lock.json
COPY package*.json ./

# Update npm to the specified version
RUN npm install -g npm@10.7.0

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose port (if your app listens on a specific port)
EXPOSE 4000

# Command to run the application
CMD ["npm", "run", "dev"]
