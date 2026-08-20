FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
COPY temporal/package*.json ./
RUN npm install
COPY tsconfig.base.json /tsconfig.base.json
COPY temporal/tsconfig.json ./
COPY temporal/src ./src
COPY temporal/src/types.ts ./src/types.ts
RUN npm run build

FROM builder AS test
COPY temporal/jest.config.js ./
COPY temporal/tests ./tests
CMD ["npm", "test", "--", "--config", "jest.config.js", "--runInBand"]

FROM builder AS production-deps
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-deps /app/dist ./dist
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/package*.json ./
EXPOSE 4000 4001
CMD ["node", "dist/worker.js"]
