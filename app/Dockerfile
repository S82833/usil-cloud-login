# Imagen propia de la aplicación (construir para linux/amd64).
FROM node:22.11.0-alpine3.20
WORKDIR /app
ENV NODE_ENV=production
# Primero las dependencias: aprovecha la caché de capas.
COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY app/src ./src
COPY app/public ./public
COPY db ./db
# Sin privilegios de root.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/salud || exit 1
CMD ["node", "src/server.js"]
