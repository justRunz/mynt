# One image for the whole app: Express serves /api and the built front end on
# one origin. The database is not in here -- it is Dokploy's, reached through
# the two URLs in the environment.

# Debian rather than Alpine: @node-rs/argon2 is a prebuilt native module, and
# the glibc build is the one every other deployment of it runs. 24 is the LTS
# line that still ships corepack; from 25 on it has to be installed by hand.
FROM node:24-bookworm-slim AS base
# pnpm at the version package.json names in packageManager, fetched by corepack
# on first use -- without stopping to ask, since nobody is there to answer.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
# The manifests alone, before any source: the install layer below is then
# rebuilt when a dependency changes and reused when only code does.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/


# --- The front end, and the migration runner ---------------------------------
FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
# VITE_API_URL is deliberately not set: the app then calls /api as a bare path,
# on the origin it was served from, and CORS never comes into it.
RUN pnpm --filter @mynt/web build
# dbmate is a root devDependency, and its npm package is a wrapper around one
# static binary per platform. Taken from the install above rather than from
# dbmate's own image, so the version is the lockfile's -- the one the
# migrations are written and tested against -- on whatever architecture this
# is built for.
RUN cp "$(find node_modules/.pnpm -path '*/@dbmate/linux-*/bin/dbmate')" /usr/local/bin/dbmate


# --- What runs ---------------------------------------------------------------
FROM base
# The backend and what it imports, without anything only a developer needs.
# There is no build step for it: it runs from source through tsx, which is why
# tsx is one of its dependencies and not a devDependency.
RUN pnpm install --frozen-lockfile --prod --filter @mynt/backend...

# tsconfig.base.json because apps/backend/tsconfig.json extends it and tsx
# reads both; packages/core because it is consumed as source, like the backend.
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/backend apps/backend
COPY db/migrations db/migrations
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /usr/local/bin/dbmate /usr/local/bin/dbmate

# production turns on Secure cookies and HSTS, turns off CORS and mounts the
# front end. 0.0.0.0 because the default, loopback, is the container's own --
# Traefik could not reach it.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001
# Without the first, dbmate would finish by writing db/schema.sql with pg_dump,
# which this image does not have. The second because the server is started from
# apps/backend and dbmate looks for ./db/migrations.
ENV DBMATE_NO_DUMP_SCHEMA=true \
    DBMATE_MIGRATIONS_DIR=/app/db/migrations
EXPOSE 3001

# Nothing here needs to write to the image, so nothing runs as root.
USER node
WORKDIR /app/apps/backend

# node rather than curl, which the slim image does not have. Unhealthy when the
# database stops answering, not only when the process does -- see /api/health.
# The start period covers the migrations, which run before the server listens.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# Migrations first, as the owner (DATABASE_URL), and the server only if they
# succeeded: code running against a schema older than itself fails one request
# at a time, which is worse than not starting. --wait because the database may
# still be coming up when this container does.
#
# exec, so that node replaces the shell and is the process Docker signals --
# otherwise SIGTERM stops at sh and the clean shutdown in server.ts never runs.
CMD ["sh", "-c", "dbmate --wait up && exec node --import tsx src/server.ts"]
