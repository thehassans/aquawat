# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the frontend with production API URL
ARG VITE_CDN_URL
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
RUN nginx -t

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
