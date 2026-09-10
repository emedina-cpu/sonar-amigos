FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY src/catalog.js ./src/catalog.js
USER node
ENV PORT=3001
EXPOSE 3001
CMD ["node", "server/index.mjs"]
