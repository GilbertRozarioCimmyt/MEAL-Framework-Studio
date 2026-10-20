# ============================================================
# MEAL Framework Studio — React frontend image
# Build stage: compile with Vite; serve stage: nginx static
# ============================================================

# ---- Build stage ------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# VITE_API_BASE is empty so the built app hits /api/* on the same origin
RUN npm run build

# ---- Serve stage ------------------------------------------------
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Nginx config: serve React SPA + proxy /api/* to Django backend
COPY nginx.conf /etc/nginx/conf.d/app.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
