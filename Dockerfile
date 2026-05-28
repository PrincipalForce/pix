FROM node:20-slim AS builder
RUN (test -f /var/lib/dpkg/statoverride && sed -i '/messagebus/d' /var/lib/dpkg/statoverride || true) && \
    apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine
# Unprivileged image runs as USER 101 (nginx) and pre-chowns /var/cache/nginx,
# /var/log/nginx, /var/run/nginx.pid for that UID — required to satisfy
# Kubernetes admission with runAsNonRoot: true.
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=nginx:nginx --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
# wget is in alpine's busybox; avoids installing curl (which would need root).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q --spider http://localhost:8080/ || exit 1
# CMD is inherited from the base image: nginx -g 'daemon off;'