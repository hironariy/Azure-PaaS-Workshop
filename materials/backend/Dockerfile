FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV WEBSITES_PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8080
CMD ["node", "dist/app.js"]
