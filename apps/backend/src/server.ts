import cors from 'cors'
import express from 'express'

import { env } from './env.js'
import { authenticate } from './middleware/authenticate.js'
import { binderRoutes } from './routes/binders.js'
import { catalogRoutes } from './routes/catalog.js'
import { collectionRoutes } from './routes/collection.js'

const app = express()

/**
 * Cross-origin only exists in development, where the app is on 5173 and this is
 * on 3001. In production both sit behind one domain -- Express serves the built
 * front end next to /api -- so there is no cross-origin request to permit, and
 * none of this runs.
 *
 * credentials is on for the cookie step 4 brings; today the token travels in an
 * Authorization header, which does not need it.
 */
app.use(cors({ origin: env.webOrigin, credentials: true }))
app.use(express.json())

// Everything below needs a signed-in caller. Mounted before the routes rather
// than repeated inside each of them, so adding a route cannot forget it.
app.use('/api', authenticate)

app.use('/api/catalog', catalogRoutes)
app.use('/api/collection', collectionRoutes)
app.use('/api/binders', binderRoutes)

/**
 * The last word on failure.
 *
 * A thrown error must not reach the client as a stack trace or a SQL string: a
 * database message names tables and columns, which is free reconnaissance. It
 * is logged in full here and answered with nothing.
 */
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error)
    res.status(500).json({ error: 'internal' })
  },
)

app.listen(env.port, () => {
  console.log(`API sur http://localhost:${env.port}`)
})
