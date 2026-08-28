# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the frontend with production API URL
ARG BUILD_SHA=unknown
ARG VITE_CDN_URL
RUN echo "Building frontend at commit ${BUILD_SHA}"
ENV VITE_API_BASE_URL=/api
ENV VITE_API_URL=/api
ENV VITE_CDN_URL=$VITE_CDN_URL
RUN npm run build

# Serve stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx config + Cloudflare visitor-IP restore (no-op unless CF is in front)
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY cloudflare-realip.conf /etc/nginx/cloudflare-realip.conf

EXPOSE 80

# nginx -t cannot run at image build: upstream "backend" is Compose DNS.
# Brace/syntax checks live in backend/tests/cdnNginx.test.js.
CMD ["nginx", "-g", "daemon off;"]
