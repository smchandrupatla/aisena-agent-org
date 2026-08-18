FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

FROM node:18-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/*.html ./
COPY --from=builder /app/*.js ./
COPY --from=builder /app/*.css ./
COPY --from=builder /app/*.json ./
COPY --from=builder /app/word-templates/ ./word-templates/

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV UPLOAD_MAX_SIZE=5242880
ENV UPLOAD_ALLOWED_TYPES="application/json,application/yaml,text/plain,text/markdown"

CMD ["node", "server.js"]