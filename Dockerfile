FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build -w server

FROM base AS web-build
ARG VITE_API_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_API_URL=$VITE_API_URL VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
RUN npm run build -w client

FROM nginxinc/nginx-unprivileged:stable-alpine AS frontend
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/client/dist /usr/share/nginx/html
EXPOSE 8080

FROM node:22-bookworm-slim AS backend
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/package*.json ./
COPY --from=base /app/client/package.json client/package.json
COPY --from=base /app/server/package.json server/package.json
COPY --from=base /app/node_modules node_modules
COPY --from=base /app/server/dist server/dist
COPY --from=base /app/server/prisma server/prisma
RUN npm prune --omit=dev && chown -R node:node /app
USER node
EXPOSE 5001
CMD ["node","server/dist/index.js"]
