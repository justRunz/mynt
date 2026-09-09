import { Router } from 'express'

import { dbQueryAs } from '../../db/index.js'
import { requireUserId } from '../../middleware/authenticate.js'
import {
  addCoinSchema,
  coinIdSchema,
  fileCoinSchema,
  movePairSchema,
  updateCoinSchema,
} from './schemas.js'
import {
  addCoin,
  countOwnedByType,
  deleteCoin,
  fileCoin,
  listCoins,
  movePair,
  unfileCoin,
  updateCoin,
} from './service.js'

export const collectionController = Router()

collectionController.get('/', async (req, res) => {
  const userId = requireUserId(req)
  res.json(await dbQueryAs(userId, (tx) => listCoins(tx)))
})

collectionController.get('/type-counts', async (req, res) => {
  const userId = requireUserId(req)
  res.json(await dbQueryAs(userId, (tx) => countOwnedByType(tx)))
})

collectionController.post('/', async (req, res) => {
  const userId = requireUserId(req)
  const input = addCoinSchema.parse(req.body)
  // The owner is the caller, taken from the verified token. It is never read
  // from the body -- not because the policy would let it through, but because a
  // route that accepts an owner is a route somebody will one day trust.
  const coinId = await dbQueryAs(userId, (tx) => addCoin(tx, userId, input))
  res.status(201).json({ coinId })
})

/**
 * Editing what a coin is. Where it sits has its own routes below, because
 * filing is a different act with different failures -- and a form that changes a
 * grade should not be able to move a coin by accident.
 */
collectionController.patch('/:coinId', async (req, res) => {
  const userId = requireUserId(req)
  const { coinId } = coinIdSchema.parse(req.params)
  const input = updateCoinSchema.parse(req.body)
  await dbQueryAs(userId, (tx) => updateCoin(tx, coinId, input))
  res.status(204).end()
})

collectionController.delete('/:coinId', async (req, res) => {
  const userId = requireUserId(req)
  const { coinId } = coinIdSchema.parse(req.params)
  await dbQueryAs(userId, (tx) => deleteCoin(tx, coinId))
  res.status(204).end()
})

/**
 * Where a coin sits, as a thing that can be put and removed.
 *
 * PUT rather than PATCH: a coin is in exactly one hole or in none, so this
 * replaces the location outright and repeating the call changes nothing.
 */
collectionController.put('/:coinId/location', async (req, res) => {
  const userId = requireUserId(req)
  const { coinId } = coinIdSchema.parse(req.params)
  const slot = fileCoinSchema.parse(req.body)
  await dbQueryAs(userId, (tx) => fileCoin(tx, coinId, slot))
  res.status(204).end()
})

collectionController.delete('/:coinId/location', async (req, res) => {
  const userId = requireUserId(req)
  const { coinId } = coinIdSchema.parse(req.params)
  await dbQueryAs(userId, (tx) => unfileCoin(tx, coinId))
  res.status(204).end()
})

/**
 * Two coins exchanging holes, which is one action and therefore one route.
 *
 * Not expressible as two calls to the location route: the first would land on a
 * hole the second has not left, and the constraint refuses it. This is also why
 * it is not /:coinId/location -- it belongs to neither coin.
 */
collectionController.post('/move-pair', async (req, res) => {
  const userId = requireUserId(req)
  const input = movePairSchema.parse(req.body)
  await dbQueryAs(userId, (tx) => movePair(tx, input))
  res.status(204).end()
})
