import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type Express } from 'express'

import { dbIsReachable } from './db/index.js'
import { env } from './env.js'
import { authenticate } from './middleware/authenticate.js'
import { errorHandler } from './middleware/error-handler.js'
import { securityHeaders } from './middleware/security-headers.js'
import { authRoutes } from './modules/auth/routes.js'
import { binderRoutes } from './modules/binders/routes.js'
import { catalogRoutes } from './modules/catalog/routes.js'
import { collectionRoutes } from './modules/collection/routes.js'

// Where `pnpm --filter @mynt/web build` leaves the front end, seen from here.
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url))

/**
 * The whole server, assembled but not listening.
 *
 * Separate from server.ts so that tests can start it on a port of their own and
 * talk to it over real HTTP: headers, status codes and rate limits are things
 * only a request can observe, and none of them is visible from a service.
 */
export function createApp(): Express {
  const app = express()

  // "X-Powered-By: Express" tells whoever asks which framework's advisories to
  // read first, and tells nobody else anything.
  app.disable('x-powered-by')
  app.use(securityHeaders)

  // Where the caller's address comes from when a proxy stands in front. See env.
  app.set('trust proxy', env.trustProxy)

  // What the container's health check asks, and so above everything a probe
  // cannot satisfy or should not spend: it holds no token, and one call every
  // few seconds from the same address must never meet a rate limit. It asks
  // the database because a server that is up but cannot reach it can answer
  // nothing else either. 503 with no reason given -- the reason is a hostname
  // and a role, and it is the pool's to log.
  app.get('/api/health', async (_req, res) => {
    const ok = await dbIsReachable()
    res.status(ok ? 200 : 503).json({ ok })
  })

  /**
   * Cross-origin only exists in development, where the app is on 5173 and this is
   * on 3001. In production both sit behind one domain -- Express serves the built
   * front end next to /api -- so there is no cross-origin request to permit, and
   * none of this runs.
   *
   * credentials is on for the refresh cookie, which is the one thing this server
   * ever expects a browser to send on its own.
   */
  if (!env.isProduction) app.use(cors({ origin: env.appUrl, credentials: true }))
  app.use(express.json())

  // The refresh token arrives as a cookie and nowhere else, so it has to be parsed
  // before any route can look for it.
  app.use(cookieParser())

  // Above the middleware on purpose, and the only thing that is: these are the
  // routes reached while holding no token, so requiring one would close the door
  // from the inside.
  app.use('/api/auth', authRoutes)

  // Everything below needs a signed-in caller. Mounted before the routes rather
  // than repeated inside each of them, so adding a route cannot forget it.
  app.use('/api', authenticate)

  app.use('/api/catalog', catalogRoutes)
  app.use('/api/collection', collectionRoutes)
  app.use('/api/binders', binderRoutes)

  // The end of /api. Without it an address no route claims would fall through
  // to the front end below and come back as a page, with a 200 -- and a client
  // expecting JSON would fail on the parse instead of on the status.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' })
  })

  /**
   * The built front end, in production only.
   *
   * Below /api on purpose: nothing here is behind authenticate, which is mounted
   * on /api alone, and nothing under /api can be answered from here. In
   * development and in the tests there is no build and Vite serves the app on
   * 5173, so none of this is mounted -- the check on the directory is for a
   * production start that forgot to build, which should serve an API and not
   * fail on every page.
   */
  if (env.isProduction && existsSync(webDist)) {
    // Vite puts a hash of the content in every name under /assets, so a file
    // there never changes: a new build is a new name. Cached for good -- and
    // answered 404 when missing rather than with the page below, because a
    // script tag handed HTML fails in a way nobody can read.
    app.use(
      '/assets',
      express.static(`${webDist}/assets`, { immutable: true, maxAge: '1y' }),
      (_req, res) => {
        res.sendStatus(404)
      },
    )

    // Everything else keeps its name from one build to the next: index.html,
    // sw.js, the manifest. express.static's default is max-age=0 with an ETag
    // -- asked about every time, sent again only when changed -- and it has to
    // stay that way: a service worker file a browser was allowed to keep is an
    // update prompt that never appears.
    app.use(express.static(webDist))

    // Routing happens in the browser, so any other address is the app's to
    // interpret: a reload on /binders/3 has to get the page, not a 404.
    //
    // root rather than one absolute path: sendFile refuses any path with a
    // dot-directory in it, and where this is checked out is not its business.
    app.get('/{*path}', (_req, res) => {
      res.sendFile('index.html', { root: webDist })
    })
  }

  app.use(errorHandler)

  return app
}
