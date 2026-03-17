FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

# Avoid lifecycle side-effects during image build; generate Prisma client explicitly.
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

# Install only production dependencies, then generate Prisma client for runtime.
RUN npm ci --omit=dev --ignore-scripts && npx prisma generate

COPY --from=build /app/dist ./dist

# Backward compatibility for file-based DATABASE_URL deployments.
RUN mkdir -p /app/data

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["npm", "run", "start:docker"]
