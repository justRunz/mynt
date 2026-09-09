import { Router } from 'express'

import { dbQueryAs } from '../../db/index.js'
import { requireUserId } from '../../middleware/authenticate.js'
import { listBinders } from './service.js'

export const binderController = Router()

binderController.get('/', async (req, res) => {
  const userId = requireUserId(req)
  res.json(await dbQueryAs(userId, (tx) => listBinders(tx)))
})
