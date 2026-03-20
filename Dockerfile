# DigitalShop Unified Deployment
# Backend serves API + Frontend static files
FROM node:18

WORKDIR /app

# Copy all source files
COPY . .

# Install dependencies for all packages
RUN cd DigitalShop-Shared && npm install
RUN cd DigitalShop-Frontend && npm install
RUN cd DigitalShop-Backend && npm install

# Build in order: Shared types -> Frontend -> Backend
RUN cd DigitalShop-Shared && npx tsc
RUN cd DigitalShop-Frontend && npx vite build
RUN cd DigitalShop-Backend && npx tsc

# Clean up dev dependencies and source to reduce image size
RUN rm -rf DigitalShop-Frontend/node_modules DigitalShop-Frontend/src \
    DigitalShop-Shared/node_modules DigitalShop-Shared/types \
    DigitalShop-Backend/src

CMD ["node", "DigitalShop-Backend/dist/server.js"]
