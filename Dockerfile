FROM node:20-slim AS builder
RUN (test -f /var/lib/dpkg/statoverride && sed -i '/messagebus/d' /var/lib/dpkg/statoverride || true) && \
    apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache curl
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -f http://localhost:8080/ || exit 1
CMD ["nginx", "-g", "daemon off;"]