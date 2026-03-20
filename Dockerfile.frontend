# ============================================================================
# UNIFIED DIGITALSHOP DEPLOYMENT
# Backend serves API + Frontend static files
# ============================================================================

FROM node:18-alpine AS build

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies for all packages
RUN cd DigitalShop-Shared && npm install
RUN cd DigitalShop-Frontend && npm install
RUN cd DigitalShop-Backend && npm install

# Build shared types first
RUN cd DigitalShop-Shared && npx tsc

# Build frontend (Vite)
RUN cd DigitalShop-Frontend && npx vite build

# Build backend (TypeScript)
RUN cd DigitalShop-Backend && npx tsc

# ============================================================================
# Production stage
# ============================================================================
FROM node:18-alpine

WORKDIR /app

# Copy built artifacts and dependencies
COPY --from=build /app/DigitalShop-Backend/dist ./DigitalShop-Backend/dist
COPY --from=build /app/DigitalShop-Backend/node_modules ./DigitalShop-Backend/node_modules
COPY --from=build /app/DigitalShop-Backend/package.json ./DigitalShop-Backend/package.json
COPY --from=build /app/DigitalShop-Frontend/dist ./DigitalShop-Frontend/dist
COPY --from=build /app/DigitalShop-Shared/sql ./DigitalShop-Shared/sql

EXPOSE 8340

CMD ["node", "DigitalShop-Backend/dist/server.js"]
