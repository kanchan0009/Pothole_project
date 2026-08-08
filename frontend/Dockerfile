# RoadGuard Web — Vite build served by nginx.
#
# nginx proxies /api and /uploads to the API service (same-origin in the
# docker-compose stack). For a separate deploy (Vercel / Render static) you
# don't need this image — set VITE_API_URL to the API's public URL at build:
#   docker build -t roadguard-web --build-arg VITE_API_URL=https://api.example.com .
FROM node:22-slim AS build

WORKDIR /app

# Workspace manifests so `npm ci -w frontend` can resolve the lockfile.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

RUN npm ci -w frontend

COPY frontend frontend

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w frontend

FROM nginx:1.27-alpine

# The official image renders *.template files with envsubst (defined env vars
# only), so nginx runtime vars like $host / $uri survive untouched.
COPY frontend/nginx.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
