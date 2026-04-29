# Multi-stage build for Cloud Run. Produces a small image that runs
# `node server.js` from Next's standalone output.

# ----- deps ---------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ----- build --------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Clerk publishable key must be present at build time because Next inlines
# NEXT_PUBLIC_* into the client bundle. CI passes it via --build-arg.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}

RUN npm run build

# ----- runtime ------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Cloud Run sets $PORT; Next.js's standalone server reads PORT.
# (Default 3000 above is for local docker-run.)

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Migrations: ship the drizzle/ SQL + a runtime-only entrypoint so a
# Cloud Run Job can apply migrations using the same image as the service.
# Standalone strips devDeps (no tsx), so we use drizzle-orm's migrator
# directly. [LAW:one-source-of-truth] — same migrations folder both paths
# use; the dev-side `npm run db:migrate` uses tsx, this one uses node.
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=build --chown=nextjs:nodejs /app/src/db/migrate-runtime.mjs ./src/db/migrate-runtime.mjs

# Next's standalone tracer doesn't see migrate-runtime.mjs (not a server
# entrypoint), so postgres + drizzle-orm don't end up in the trimmed
# node_modules. Both have zero transitive deps, so explicit COPYs are
# the smallest fix; the Job and the Next runtime resolve from the same
# /app/node_modules tree.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
