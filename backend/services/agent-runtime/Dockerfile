FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY services/agent-runtime/package*.json ./
RUN npm install
COPY tsconfig.base.json /tsconfig.base.json
COPY services/agent-runtime/tsconfig.json ./
COPY services/agent-runtime/src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
