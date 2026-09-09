import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'

import { env } from './env.js'
import { authenticate } from './middleware/authenticate.js'
import { errorHandler } from './middleware/error-handler.js'
import { authController } from './modules/auth/controller.js'
import { binderController } from './modules/binders/controller.js'
import { catalogController } from './modules/catalog/controller.js'
import { collectionController } from './modules/collection/controller.js'

const app = express()

/**
 * Cross-origin only exists in development, where the app is on 5173 and this is
 * on 3001. In production both sit behind one domain -- Express serves the built
 * front end next to /api -- so there is no cross-origin request to permit, and
 * none of this runs.
 *
 * credentials is on for the refresh cookie the auth step brings; today the token travels in an
 * Authorization header, which does not need it.
 */
app.use(cors({ origin: env.webOrigin, credentials: true }))
app.use(express.json())

// The refresh token arrives as a cookie and nowhere else, so it has to be parsed
// before any route can look for it.
app.use(cookieParser())

// Above the middleware on purpose, and the only thing that is: these are the
// routes reached while holding no token, so requiring one would close the door
// from the inside.
app.use('/api/auth', authController)

// Everything below needs a signed-in caller. Mounted before the routes rather
// than repeated inside each of them, so adding a route cannot forget it.
app.use('/api', authenticate)

app.use('/api/catalog', catalogController)
app.use('/api/collection', collectionController)
app.use('/api/binders', binderController)

app.use(errorHandler)

app.listen(env.port, () => {
  console.log(`API sur http://localhost:${env.port}`)
})
