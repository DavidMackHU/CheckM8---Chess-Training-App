# Build context is the repo root (npm workspaces share one lockfile).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci -w server
COPY server server
RUN npm run build -w server

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci -w server --omit=dev
COPY --from=build /app/server/dist server/dist
WORKDIR /app/server
EXPOSE 3001
CMD ["node", "dist/index.js"]
