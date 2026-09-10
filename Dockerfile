FROM node:24-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY server ./server
COPY src/catalog.js ./src/catalog.js
USER node
ENV PORT=3001
EXPOSE 3001
CMD ["node", "server/index.mjs"]
