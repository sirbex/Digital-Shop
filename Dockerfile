# DigitalShop Unified Deployment
# Backend serves API + Frontend static files
FROM node:18

WORKDIR /app

# Copy all source files
COPY . .

# Install ALL dependencies (including devDependencies needed for build)
ENV NODE_ENV=development
RUN cd DigitalShop-Shared && npm install
RUN cd DigitalShop-Frontend && npm install
RUN cd DigitalShop-Backend && npm install

# Build in order: Shared types -> Frontend -> Backend
RUN cd DigitalShop-Shared && npx tsc
RUN cd DigitalShop-Frontend && npx vite build
RUN cd DigitalShop-Backend && npx tsc

# Switch to production and prune dev dependencies
ENV NODE_ENV=production
RUN cd DigitalShop-Backend && npm prune --production

# Clean up source and frontend deps (no longer needed at runtime)
RUN rm -rf DigitalShop-Frontend/node_modules DigitalShop-Frontend/src \
    DigitalShop-Shared/node_modules DigitalShop-Shared/types \
    DigitalShop-Backend/src

CMD ["node", "DigitalShop-Backend/dist/server.js"]
