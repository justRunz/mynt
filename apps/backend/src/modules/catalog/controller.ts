import type { Request, Response } from 'express'

import { dbQueryAs } from '../../db/index.js'
import { requireUserId } from '../../middleware/authenticate.js'
import * as service from './service.js'

/**
 * The catalog over HTTP, as handlers and nothing else.
 *
 * A handler does three things and refuses the fourth: it learns who is asking,
 * opens the transaction, calls the service, and answers. It contains no SQL and
 * declares no path -- the path lives in routes.ts -- so "what does this endpoint
 * do" is answered here, "how" in the service, and "where" in one file per module.
 *
 * The transaction is opened here rather than inside the service because a route
 * that needs two services needs them in *one* transaction -- filing a coin
 * touches coins and reads pages. If each service opened its own, a request could
 * half-apply.
 *
 * The service is imported as a namespace, so a handler and the function it calls
 * can share a name -- listCountries calls service.listCountries -- and the layer
 * being crossed is visible at the call.
 */

export async function listCountries(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req)
  res.json(await dbQueryAs(userId, (tx) => service.listCountries(tx)))
}

export async function listCoinTypes(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req)
  res.json(await dbQueryAs(userId, (tx) => service.listCoinTypes(tx)))
}
