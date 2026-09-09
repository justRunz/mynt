import { Router } from 'express'

import { dbQueryAs } from '../../db/index.js'
import { requireUserId } from '../../middleware/authenticate.js'
import { countOwnedByType, listCoins } from './service.js'

export const collectionController = Router()

collectionController.get('/', async (req, res) => {
  const userId = requireUserId(req)
  res.json(await dbQueryAs(userId, (tx) => listCoins(tx)))
})

collectionController.get('/type-counts', async (req, res) => {
  const userId = requireUserId(req)
  res.json(await dbQueryAs(userId, (tx) => countOwnedByType(tx)))
})
