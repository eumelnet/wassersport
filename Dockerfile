FROM node:20-alpine

# sharp is a native addon that links against libvips. On Alpine we install
# the prebuilt musl binary via npm; no extra system packages are required
# because sharp>=0.33 ships with alpine-musl prebuilt binaries.
# If that changes, add: RUN apk add --no-cache vips-dev build-base python3

WORKDIR /app

# Install deps first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application source
COPY . .

# Drop to non-root (matches helm chart's runAsUser: 1000)
RUN addgroup -g 1000 -S app && adduser -S -u 1000 -G app app \
 && mkdir -p /app/data/uploads \
 && chown -R app:app /app
USER app

EXPOSE 3000

CMD ["node", "server.js"]
