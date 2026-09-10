import type { Request, Response } from 'express'

import { dbQueryAs } from '../../db/index.js'
import { requireUserId } from '../../middleware/authenticate.js'
import { binderIdSchema, createBinderSchema, createPageSchema } from './schemas.js'
import * as service from './service.js'

export async function listBinders(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req)
  res.json(await dbQueryAs(userId, (tx) => service.listBinders(tx)))
}

export async function createBinder(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req)
  const input = createBinderSchema.parse(req.body)
  const binderId = await dbQueryAs(userId, (tx) => service.createBinder(tx, userId, input))
  res.status(201).json({ binderId })
}

/**
 * A sheet, created under the binder it belongs to.
 *
 * The binder is in the path rather than the body, because a page has no
 * existence apart from one -- and a path says that in a way a field beside three
 * others does not.
 */
export async function createPage(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req)
  const { binderId } = binderIdSchema.parse(req.params)
  const input = createPageSchema.parse(req.body)
  const pageId = await dbQueryAs(userId, (tx) => service.createPage(tx, binderId, input))
  res.status(201).json({ pageId })
}
