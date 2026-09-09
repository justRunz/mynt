import { Router } from 'express'

import { dbQueryAs } from '../../db/index.js'
import { requireUserId } from '../../middleware/authenticate.js'
import { listCoinTypes, listCountries } from './service.js'

/**
 * The catalog over HTTP.
 *
 * A controller does three things and refuses the fourth: it learns who is
 * asking, opens the transaction, calls the service, and answers. It contains no
 * SQL, so the question "what does this endpoint read" is answered in one file
 * and the question "how" in another.
 *
 * The transaction is opened here rather than inside the service because a route
 * that needs two services needs them in *one* transaction -- filing a coin
 * touches coins and reads pages. If each service opened its own, a request could
 * half-apply.
 */
export const catalogController = Router()

catalogController.get('/countries', async (req, res) => {
  const userId = requireUserId(req)
  res.json(await dbQueryAs(userId, (tx) => listCountries(tx)))
})

catalogController.get('/coin-types', async (req, res) => {
  const userId = requireUserId(req)
  res.json(await dbQueryAs(userId, (tx) => listCoinTypes(tx)))
})
