import type { Request, Response } from 'express'

import { dbQueryAs } from '../../db/index.js'
import { requireUserId } from '../../middleware/authenticate.js'
import {
  addCoinSchema,
  coinIdSchema,
  fileCoinSchema,
  movePairSchema,
  updateCoinSchema,
} from './schemas.js'
import * as service from './service.js'

export async function listCoins(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req)
  res.json(await dbQueryAs(userId, (tx) => service.listCoins(tx)))
}

export async function countOwnedByType(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req)
  res.json(await dbQueryAs(userId, (tx) => service.countOwnedByType(tx)))
}

export async function addCoin(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req)
  const input = addCoinSchema.parse(req.body)
  // The owner is the caller, taken from the verified token. It is never read
  // from the body -- not because the policy would let it through, but because a
  // route that accepts an owner is a route somebody will one day trust.
  const coinId = await dbQueryAs(userId, (tx) => service.addCoin(tx, userId, input))
  res.status(201).json({ coinId })
}

/**
 * Editing what a coin is. Where it sits has its own routes below, because
 * filing is a different act with different failures -- and a form that changes a
 * grade should not be able to move a coin by accident.
 */
export async function updateCoin(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req)
  const { coinId } = coinIdSchema.parse(req.params)
  const input = updateCoinSchema.parse(req.body)
  await dbQueryAs(userId, (tx) => service.updateCoin(tx, coinId, input))
  res.status(204).end()
}

export async function deleteCoin(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req)
  const { coinId } = coinIdSchema.parse(req.params)
  await dbQueryAs(userId, (tx) => service.deleteCoin(tx, coinId))
  res.status(204).end()
}

/**
 * Where a coin sits, as a thing that can be put and removed.
 *
 * PUT rather than PATCH: a coin is in exactly one hole or in none, so this
 * replaces the location outright and repeating the call changes nothing.
 */
export async function fileCoin(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req)
  const { coinId } = coinIdSchema.parse(req.params)
  const slot = fileCoinSchema.parse(req.body)
  await dbQueryAs(userId, (tx) => service.fileCoin(tx, coinId, slot))
  res.status(204).end()
}

export async function unfileCoin(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req)
  const { coinId } = coinIdSchema.parse(req.params)
  await dbQueryAs(userId, (tx) => service.unfileCoin(tx, coinId))
  res.status(204).end()
}

/**
 * Two coins exchanging holes, which is one action and therefore one route.
 *
 * Not expressible as two calls to the location route: the first would land on a
 * hole the second has not left, and the constraint refuses it. This is also why
 * its path is not /:coinId/location -- it belongs to neither coin.
 */
export async function movePair(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req)
  const input = movePairSchema.parse(req.body)
  await dbQueryAs(userId, (tx) => service.movePair(tx, input))
  res.status(204).end()
}
