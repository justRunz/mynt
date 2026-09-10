import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type Express } from 'express'

import { env } from './env.js'
import { authenticate } from './middleware/authenticate.js'
import { errorHandler } from './middleware/error-handler.js'
import { securityHeaders } from './middleware/security-headers.js'
import { authRoutes } from './modules/auth/routes.js'
import { binderRoutes } from './modules/binders/routes.js'
import { catalogRoutes } from './modules/catalog/routes.js'
import { collectionRoutes } from './modules/collection/routes.js'

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


  /**
   * Cross-origin only exists in development, where the app is on 5173 and this is
   * on 3001. In production both sit behind one domain -- Express serves the built
   * front end next to /api -- so there is no cross-origin request to permit, and
   * none of this runs.
   *
   * credentials is on for the refresh cookie, which is the one thing this server
   * ever expects a browser to send on its own.
   */
  app.use(cors({ origin: env.appUrl, credentials: true }))
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

  app.use(errorHandler)

  return app
}
